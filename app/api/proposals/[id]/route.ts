import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export const runtime = "nodejs";

interface PatchBody {
  status: "approved" | "rejected";
}

type Client = SupabaseClient<Database>;

const PLAN_KEYS = ["why", "who", "what", "how"] as const;
type PlanKey = (typeof PLAN_KEYS)[number];

/** kind=execution_plan の提案を承認したとき、diff を execution_plans に upsert する。
 *  diff のキーは PLAN_KEYS のいずれか、値は文字列のみ受け入れる。 */
async function applyExecutionPlanDiff(
  supabase: Client,
  projectId: string,
  diff: unknown,
): Promise<string | null> {
  if (!diff || typeof diff !== "object" || Array.isArray(diff)) {
    return "diff が空または不正です";
  }
  const obj = diff as Record<string, unknown>;
  const patch: Partial<Record<PlanKey, string>> = {};
  for (const k of PLAN_KEYS) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) {
      patch[k] = v.trim();
    }
  }
  if (Object.keys(patch).length === 0) {
    return "更新可能なフィールドがありません";
  }

  // 既存 plan を取得 → 無ければ作成
  const { data: existing } = await supabase
    .from("execution_plans")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("execution_plans")
      .update(patch)
      .eq("id", existing.id);
    if (error) return error.message;
  } else {
    const { error } = await supabase.from("execution_plans").insert({
      project_id: projectId,
      ...patch,
    });
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

  if (body.status === "approved" && prop.kind === "execution_plan") {
    const applyErr = await applyExecutionPlanDiff(
      supabase,
      prop.project_id,
      prop.diff,
    );
    if (applyErr) {
      return NextResponse.json(
        { error: `反映に失敗しました: ${applyErr}` },
        { status: 500 },
      );
    }
  }
  // TODO: 他 kind (wbs, budget, ...) の diff 適用は別 PR で

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
