// ============================================================
// sync-task-to-ws — PM の tasks 変更をワークスペース(WS)へ連携
// ============================================================
// PM Supabase の Database Webhook (tasks の INSERT/UPDATE/DELETE) から
// 呼ばれ、WS Supabase の ka_tasks へ「人(email)単位」で upsert/delete する。
//
// 設計の前提:
//   - 跨ぎ突合キーは email (両アプリとも Google ログイン)
//   - PM 由来タスクは WS の組織階層の外に置く → organization_id は NULL
//     (プロジェクトは部署横断のため org に紐づけない)
//   - 連携の単位は person。担当(assignee_email)が無いタスクは「誰のタスク
//     でもない」ため WS には載せない (既存ミラーがあれば消す)
//   - 冪等性は ka_tasks.pm_task_id (PM tasks.id) で担保
//
// 必要なシークレット (supabase secrets set ...):
//   WS_SUPABASE_URL        : WS プロジェクトの URL
//   WS_SERVICE_ROLE_KEY    : WS の service_role キー (書き込み用)
//   WEBHOOK_SECRET         : Webhook 検証用の共有シークレット
// PM 自身の URL / service_role は実行環境が自動注入する
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY を使う。

type TaskRecord = {
  id: string;
  project_id: string | null;
  title: string | null;
  owner_name: string | null;
  assignee_email: string | null;
  status: "todo" | "doing" | "review" | "done" | null;
  end_date: string | null;
};

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: TaskRecord | null;
  old_record: TaskRecord | null;
};

const WS_URL = Deno.env.get("WS_SUPABASE_URL") ?? "";
const WS_KEY = Deno.env.get("WS_SERVICE_ROLE_KEY") ?? "";
const PM_URL = Deno.env.get("SUPABASE_URL") ?? "";
const PM_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";

// PM status → WS (status, done)
function mapStatus(s: TaskRecord["status"]): { status: string; done: boolean } {
  switch (s) {
    case "done":
      return { status: "done", done: true };
    case "doing":
    case "review":
      return { status: "in_progress", done: false };
    case "todo":
    default:
      return { status: "not_started", done: false };
  }
}

function wsHeaders(extra: Record<string, string> = {}): HeadersInit {
  return {
    apikey: WS_KEY,
    Authorization: `Bearer ${WS_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

// WS members から email で表示名を解決 (無ければ null)
async function resolveWsMemberName(email: string): Promise<string | null> {
  const url =
    `${WS_URL}/rest/v1/members?select=name&email=ilike.${encodeURIComponent(email)}&limit=1`;
  const res = await fetch(url, { headers: wsHeaders() });
  if (!res.ok) return null;
  const rows = (await res.json()) as { name: string | null }[];
  return rows[0]?.name ?? null;
}

// PM の projects から project 名を解決
async function resolvePmProjectName(projectId: string): Promise<string | null> {
  const url =
    `${PM_URL}/rest/v1/projects?select=name&id=eq.${projectId}&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: PM_KEY,
      Authorization: `Bearer ${PM_KEY}`,
    },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as { name: string | null }[];
  return rows[0]?.name ?? null;
}

// WS の ka_tasks から PM タスクのミラーを削除
async function deleteMirror(pmTaskId: string): Promise<Response> {
  return await fetch(
    `${WS_URL}/rest/v1/ka_tasks?pm_task_id=eq.${pmTaskId}`,
    { method: "DELETE", headers: wsHeaders() },
  );
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  if (WEBHOOK_SECRET && req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!WS_URL || !WS_KEY) {
    return new Response("WS env not configured", { status: 500 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const rec = payload.record;
  const old = payload.old_record;

  try {
    // 削除 → ミラーも削除
    if (payload.type === "DELETE") {
      if (old?.id) await deleteMirror(old.id);
      return new Response("ok", { status: 200 });
    }

    if (!rec?.id) return new Response("ok", { status: 200 });

    // 担当(email)が無い = 誰のタスクでもない → ミラーは作らない/消す
    const email = rec.assignee_email?.toLowerCase() ?? null;
    if (!email) {
      await deleteMirror(rec.id);
      return new Response("ok (unassigned, mirror removed)", { status: 200 });
    }

    const { status, done } = mapStatus(rec.status);
    const [assigneeName, projectName] = await Promise.all([
      resolveWsMemberName(email),
      rec.project_id ? resolvePmProjectName(rec.project_id) : Promise.resolve(null),
    ]);

    const row = {
      pm_task_id: rec.id,
      source: "pm",
      title: rec.title ?? "(無題タスク)",
      assignee_email: email,
      assignee: assigneeName ?? rec.owner_name ?? null,
      due_date: rec.end_date,
      status,
      done,
      project_id: rec.project_id,
      project_name: projectName,
      organization_id: null,
    };

    // pm_task_id 一意キーで upsert (merge-duplicates)
    const res = await fetch(
      `${WS_URL}/rest/v1/ka_tasks?on_conflict=pm_task_id`,
      {
        method: "POST",
        headers: wsHeaders({ Prefer: "resolution=merge-duplicates" }),
        body: JSON.stringify(row),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      return new Response(`WS upsert failed: ${res.status} ${body}`, {
        status: 502,
      });
    }
    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response(`error: ${e instanceof Error ? e.message : String(e)}`, {
      status: 500,
    });
  }
});
