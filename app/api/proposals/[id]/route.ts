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

/** kind=budget の提案を承認したとき、breakeven_plans.data に反映。
 *  既存 data とマージする (提案されたキーだけ差し替え、無いキーは既存を残す)。 */
async function applyBudgetDiff(
  supabase: Client,
  projectId: string,
  diff: unknown,
): Promise<string | null> {
  if (!diff || typeof diff !== "object" || Array.isArray(diff)) {
    return "diff が空または不正です";
  }
  const obj = diff as {
    phases?: unknown[];
    revenues?: unknown[];
    fixed?: unknown[];
    oneoff?: unknown[];
  };
  const hasAny =
    (Array.isArray(obj.phases) && obj.phases.length > 0) ||
    (Array.isArray(obj.revenues) && obj.revenues.length > 0) ||
    (Array.isArray(obj.fixed) && obj.fixed.length > 0) ||
    (Array.isArray(obj.oneoff) && obj.oneoff.length > 0);
  if (!hasAny) return "更新可能なフィールドがありません";

  // 既存を取得してマージ
  const { data: existing } = await supabase
    .from("breakeven_plans")
    .select("data")
    .eq("project_id", projectId)
    .maybeSingle();

  const prev = (existing?.data ?? {}) as {
    phases?: unknown[];
    revenues?: unknown[];
    fixed?: unknown[];
    oneoff?: unknown[];
  };
  const merged = {
    phases: Array.isArray(obj.phases) ? obj.phases : (prev.phases ?? []),
    revenues: Array.isArray(obj.revenues)
      ? obj.revenues
      : (prev.revenues ?? []),
    fixed: Array.isArray(obj.fixed) ? obj.fixed : (prev.fixed ?? []),
    oneoff: Array.isArray(obj.oneoff) ? obj.oneoff : (prev.oneoff ?? []),
  };

  const { error } = await supabase
    .from("breakeven_plans")
    .upsert(
      { project_id: projectId, data: merged as never } as never,
      { onConflict: "project_id" },
    );
  if (error) return error.message;
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
    } else if (prop.kind === "budget") {
      applyErr = await applyBudgetDiff(supabase, prop.project_id, prop.diff);
    }
    // TODO: wbs / team は別 PR で
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
