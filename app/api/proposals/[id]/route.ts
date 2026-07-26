import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export const runtime = "nodejs";

interface PatchBody {
  status: "approved" | "rejected";
}

type Client = SupabaseClient<Database>;

// Why/Who/What/How の 4 項目
const PLAN_KEYS = ["why", "who", "what", "how"] as const;
// マーケティング 4P
const MARKETING_KEYS = ["product", "price", "place", "promotion"] as const;
type PlanKey = (typeof PLAN_KEYS)[number];
type MarketingKey = (typeof MARKETING_KEYS)[number];
type AllKey = PlanKey | MarketingKey;

/** kind=execution_plan / marketing の提案を承認したとき、
 *  diff を execution_plans に upsert する。
 *  execution_plans に product/price/place/promotion カラムが既存の前提。 */
async function applyPlanOrMarketingDiff(
  supabase: Client,
  projectId: string,
  diff: unknown,
  allowedKeys: readonly AllKey[],
): Promise<string | null> {
  if (!diff || typeof diff !== "object" || Array.isArray(diff)) {
    return "diff が空または不正です";
  }
  const obj = diff as Record<string, unknown>;
  const patch: Partial<Record<AllKey, string>> = {};
  for (const k of allowedKeys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) {
      patch[k] = v.trim();
    }
  }
  if (Object.keys(patch).length === 0) {
    return "更新可能なフィールドがありません";
  }

  const { data: existing } = await supabase
    .from("execution_plans")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("execution_plans")
      .update(patch as never)
      .eq("id", existing.id);
    if (error) return error.message;
  } else {
    const { error } = await supabase.from("execution_plans").insert({
      project_id: projectId,
      ...patch,
    } as never);
    if (error) return error.message;
  }
  return null;
}

/** kind=wbs の提案を承認したとき、tasks テーブルに一括挿入。
 *  既存タスクと title が完全一致するものはスキップする (冪等)。 */
async function applyWbsDiff(
  supabase: Client,
  projectId: string,
  diff: unknown,
): Promise<string | null> {
  if (!diff || typeof diff !== "object" || Array.isArray(diff)) {
    return "diff が空または不正です";
  }
  const obj = diff as { tasks?: unknown[] };
  if (!Array.isArray(obj.tasks) || obj.tasks.length === 0) {
    return "追加可能なタスクがありません";
  }

  const rows: {
    project_id: string;
    title: string;
    owner_name: string | null;
    start_week: number | null;
    span_week: number | null;
    tag: string | null;
    is_milestone: boolean;
    status: "todo";
  }[] = [];
  for (const t of obj.tasks) {
    if (!t || typeof t !== "object" || Array.isArray(t)) continue;
    const r = t as Record<string, unknown>;
    const title = typeof r.title === "string" ? r.title.trim() : "";
    if (!title) continue;
    rows.push({
      project_id: projectId,
      title,
      owner_name:
        typeof r.owner_name === "string" && r.owner_name.trim()
          ? r.owner_name.trim()
          : null,
      start_week:
        typeof r.start_week === "number" && Number.isFinite(r.start_week)
          ? Math.max(1, Math.round(r.start_week))
          : null,
      span_week:
        typeof r.span_week === "number" && Number.isFinite(r.span_week)
          ? Math.max(0, Math.round(r.span_week))
          : null,
      tag:
        typeof r.tag === "string" && r.tag.trim() ? r.tag.trim() : null,
      is_milestone: r.is_milestone === true,
      status: "todo",
    });
  }
  if (rows.length === 0) return "追加可能なタスクがありません";

  // 既存タスクと title で重複するものは除外
  const { data: existing } = await supabase
    .from("tasks")
    .select("title")
    .eq("project_id", projectId);
  const seen = new Set(
    (existing ?? []).map((t: { title: string }) => t.title.trim()),
  );
  const toInsert = rows.filter((r) => !seen.has(r.title));
  if (toInsert.length === 0) {
    return null; // 全て既存 → 冪等に成功扱い
  }

  const { error } = await supabase
    .from("tasks")
    .insert(toInsert as never);
  if (error) return error.message;
  return null;
}

/** kind=budget の提案を承認したとき、budget_items に一括挿入する。
 *  同 project 内で同名の item は monthly_amounts をマージ (キー単位で上書き)。 */
async function applyBudgetDiff(
  supabase: Client,
  projectId: string,
  diff: unknown,
): Promise<string | null> {
  if (!diff || typeof diff !== "object" || Array.isArray(diff)) {
    return "diff が空または不正です";
  }
  const obj = diff as { items?: unknown[] };
  if (!Array.isArray(obj.items) || obj.items.length === 0) {
    return "追加可能な収支項目がありません";
  }

  // budget_items の monthly_amounts は
  //   { "7": { plan: N, actual: N }, "8": { plan: N, actual: N } } の形式。
  // AI 提案側はフラット数値 { "7": N } なので plan にセットして actual=0 で入れる。
  type Cell = { plan: number; actual: number };
  type MonthlyMap = Record<string, Cell>;

  // 既存の budget_items を name でルックアップできるように取得
  const { data: existing } = await supabase
    .from("budget_items")
    .select("id, kind, name, monthly_amounts, plan_jpy, actual_jpy")
    .eq("project_id", projectId);
  const existingByName = new Map(
    (
      (existing ?? []) as Array<{
        id: string;
        kind: string;
        name: string;
        monthly_amounts: MonthlyMap | Record<string, number> | null;
        plan_jpy: number;
        actual_jpy: number;
      }>
    ).map((e) => [`${e.kind}::${e.name.trim()}`, e]),
  );

  const normalizeExistingMonthly = (raw: unknown): MonthlyMap => {
    if (!raw || typeof raw !== "object") return {};
    const result: MonthlyMap = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (v && typeof v === "object") {
        const obj = v as Record<string, unknown>;
        result[k] = {
          plan: typeof obj.plan === "number" ? obj.plan : 0,
          actual: typeof obj.actual === "number" ? obj.actual : 0,
        };
      } else if (typeof v === "number") {
        // legacy: フラット数値なら plan として扱う
        result[k] = { plan: v, actual: 0 };
      }
    }
    return result;
  };

  const inserts: Array<{
    project_id: string;
    kind: string;
    category: string | null;
    name: string;
    monthly_amounts: MonthlyMap;
    plan_jpy: number;
  }> = [];
  const updates: Array<{
    id: string;
    monthly_amounts: MonthlyMap;
    plan_jpy: number;
  }> = [];

  for (const it of obj.items) {
    if (!it || typeof it !== "object" || Array.isArray(it)) continue;
    const r = it as Record<string, unknown>;
    const rawKind = typeof r.kind === "string" ? r.kind.trim() : "";
    if (!["income", "cogs", "sga", "expense"].includes(rawKind)) continue;
    const name =
      typeof r.name === "string" && r.name.trim() ? r.name.trim() : "";
    if (!name) continue;
    const category =
      typeof r.category === "string" && r.category.trim()
        ? r.category.trim()
        : null;

    // AI 側のフラット数値 { "7": 30000 } を { "7": {plan:30000, actual:0} } に変換
    const monthly: MonthlyMap = {};
    const ma = r.monthly_amounts;
    if (ma && typeof ma === "object" && !Array.isArray(ma)) {
      for (const [k, v] of Object.entries(ma)) {
        const mnum = Number.parseInt(k, 10);
        if (!Number.isFinite(mnum) || mnum < 1 || mnum > 12) continue;
        const amt = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(amt) || amt === 0) continue;
        monthly[String(mnum)] = { plan: Math.round(amt), actual: 0 };
      }
    }
    if (Object.keys(monthly).length === 0) continue;

    const sumPlan = (m: MonthlyMap) =>
      Object.values(m).reduce((a, c) => a + (c.plan ?? 0), 0);

    const dupKey = `${rawKind}::${name}`;
    const dup = existingByName.get(dupKey);
    if (dup) {
      // 既存の monthly_amounts に上書きマージ (actual は保存)
      const existingMonthly = normalizeExistingMonthly(dup.monthly_amounts);
      const merged: MonthlyMap = { ...existingMonthly };
      for (const [k, cell] of Object.entries(monthly)) {
        merged[k] = {
          plan: cell.plan,
          actual: existingMonthly[k]?.actual ?? 0,
        };
      }
      updates.push({
        id: dup.id,
        monthly_amounts: merged,
        plan_jpy: sumPlan(merged),
      });
    } else {
      inserts.push({
        project_id: projectId,
        kind: rawKind,
        category,
        name,
        monthly_amounts: monthly,
        plan_jpy: sumPlan(monthly),
      });
    }
  }

  if (inserts.length === 0 && updates.length === 0) {
    return "追加可能な収支項目がありません";
  }

  if (inserts.length > 0) {
    const { error } = await supabase
      .from("budget_items")
      .insert(inserts as never);
    if (error) return error.message;
  }
  for (const u of updates) {
    const { error } = await supabase
      .from("budget_items")
      .update({
        monthly_amounts: u.monthly_amounts as never,
        plan_jpy: u.plan_jpy,
      } as never)
      .eq("id", u.id);
    if (error) return error.message;
  }
  return null;
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await req.json()) as PatchBody;
  if (!["approved", "rejected"].includes(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 承認前に proposal の中身を見て diff 適用を試みる
  const { data: prop, error: fetchErr } = await supabase
    .from("proposals")
    .select("project_id, kind, diff, status")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!prop) {
    return NextResponse.json({ error: "提案が見つかりません" }, { status: 404 });
  }

  if (body.status === "approved") {
    let applyErr: string | null = null;
    if (prop.kind === "execution_plan") {
      applyErr = await applyPlanOrMarketingDiff(
        supabase,
        prop.project_id,
        prop.diff,
        [...PLAN_KEYS, ...MARKETING_KEYS], // Why/Who/What/How + 4P すべて許可
      );
    } else if (prop.kind === "marketing") {
      applyErr = await applyPlanOrMarketingDiff(
        supabase,
        prop.project_id,
        prop.diff,
        MARKETING_KEYS,
      );
    } else if (prop.kind === "wbs") {
      applyErr = await applyWbsDiff(supabase, prop.project_id, prop.diff);
    } else if (prop.kind === "budget") {
      applyErr = await applyBudgetDiff(supabase, prop.project_id, prop.diff);
    }
    // TODO: promo / application / theme / diagnosis は別 PR で
    if (applyErr) {
      return NextResponse.json(
        { error: `反映に失敗しました: ${applyErr}` },
        { status: 500 },
      );
    }
  }

  const { data, error } = await supabase
    .from("proposals")
    .update({
      status: body.status,
      decided_at: new Date().toISOString(),
      decided_by: user.id,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ proposal: data });
}
