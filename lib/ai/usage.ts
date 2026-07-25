import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

/** Anthropic Claude Haiku 4.5 の料金 (2026 年基準・USD 155円換算)。
 *  変更があったら定数だけ差し替える。 */
export const HAIKU_PRICE = {
  /** 入力トークン単価 (¥/M tokens) */
  inputPerMTok: 155,
  /** 出力トークン単価 (¥/M tokens) */
  outputPerMTok: 775,
};

/** 各プロジェクトの月次 AI 使用額の上限 (円)。 */
export const MONTHLY_LIMIT_YEN = 1000;

/** 警告バナーを出し始めるしきい値 (0〜1)。 */
export const WARNING_THRESHOLD = 0.8;

/** トークン数から円コストを計算。 */
export function calcCostYen(
  inputTokens: number,
  outputTokens: number,
): number {
  const inputYen = (inputTokens / 1_000_000) * HAIKU_PRICE.inputPerMTok;
  const outputYen = (outputTokens / 1_000_000) * HAIKU_PRICE.outputPerMTok;
  return Math.round((inputYen + outputYen) * 1000) / 1000; // 小数第3位まで
}

/** service-role で ai_usage にアクセスするための admin client を作る。 */
function makeAdmin(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "AI usage tracking: SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL が未設定",
    );
  }
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** 現在月 (今月 1 日 00:00 の ISO 文字列)。 */
function startOfCurrentMonthIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** プロジェクトの今月の使用額 (円) を取得。 */
export async function getProjectMonthUsageYen(
  projectId: string,
): Promise<number> {
  const admin = makeAdmin();
  const { data, error } = await admin
    .from("ai_usage")
    .select("cost_yen")
    .eq("project_id", projectId)
    .gte("created_at", startOfCurrentMonthIso());
  if (error) {
    console.warn("[ai/usage] fetch failed", error.message);
    return 0;
  }
  return (data ?? []).reduce(
    (sum, row) => sum + Number(row.cost_yen ?? 0),
    0,
  );
}

/** 上限チェック結果。 */
export interface UsageStatus {
  usedYen: number;
  limitYen: number;
  remainingYen: number;
  ratio: number; // 0〜1+
  /** 上限超過したので新規呼び出しは blocked */
  blocked: boolean;
  /** 警告レベル (>=WARNING_THRESHOLD) */
  warning: boolean;
}

/** 上限に対する現状を返す。API 呼び出し前チェック / UI 表示両方で使う。 */
export async function getUsageStatus(
  projectId: string,
): Promise<UsageStatus> {
  const usedYen = await getProjectMonthUsageYen(projectId);
  const ratio = usedYen / MONTHLY_LIMIT_YEN;
  return {
    usedYen,
    limitYen: MONTHLY_LIMIT_YEN,
    remainingYen: Math.max(0, MONTHLY_LIMIT_YEN - usedYen),
    ratio,
    blocked: usedYen >= MONTHLY_LIMIT_YEN,
    warning: ratio >= WARNING_THRESHOLD,
  };
}

/** Anthropic 応答から入出力トークンを抽出。
 *  SDK は usage.input_tokens / usage.output_tokens を持つ。 */
export function extractTokens(response: unknown): {
  input: number;
  output: number;
} {
  const r = response as {
    usage?: { input_tokens?: number; output_tokens?: number };
  } | null;
  return {
    input: r?.usage?.input_tokens ?? 0,
    output: r?.usage?.output_tokens ?? 0,
  };
}

/** 使用ログを 1 行 insert。失敗してもユーザ体験は止めず warn ログのみ。 */
export async function recordUsage(params: {
  projectId: string;
  organizationId: string;
  userId?: string | null;
  endpoint: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<{ costYen: number }> {
  const costYen = calcCostYen(params.inputTokens, params.outputTokens);
  const admin = makeAdmin();
  const { error } = await admin.from("ai_usage").insert({
    project_id: params.projectId,
    organization_id: params.organizationId,
    user_id: params.userId ?? null,
    endpoint: params.endpoint,
    model: params.model,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    cost_yen: costYen,
  } as never);
  if (error) {
    console.warn("[ai/usage] insert failed", error.message);
  }
  return { costYen };
}
