/** テーマ公開審査の AI 採点ロジック (サーバ/クライアント共有の純モジュール)。
 *  Why/Who/What/How と同じく「言葉の基準」で各項目 0〜100 を判定するが、
 *  点数は 5 点刻みに丸める。70 点が公開できる最低水準 (申請ゲートの基準)。 */

import type { Database } from "@/lib/types/database";

type Theme = Database["public"]["Tables"]["themes"]["Row"];

/** 申請の最低水準 (必須)。全項目がこの点数以上で申請できる。 */
export const THEME_SCORE_THRESHOLD = 50;
/** 推奨水準 (目標)。安心して公開できる目安点。 */
export const THEME_SCORE_TARGET = 70;

export type ThemeScoreTier = "fail" | "min" | "target";

/** 採点 tier。fail=申請不可 / min=申請可だが目標未達 / target=目標達成。 */
export function themeScoreTier(score: number): ThemeScoreTier {
  if (score < THEME_SCORE_THRESHOLD) return "fail";
  if (score < THEME_SCORE_TARGET) return "min";
  return "target";
}

/** 採点対象のテキスト項目 (画像・NEO3基準は対象外)。
 *  item_key は ThemeReviewPanel / ThemeForm と共通に保つこと。
 *  並び順はフォームの表示順と一致させる。 */
export const THEME_SCORE_ITEMS = [
  { key: "title", label: "課題テーマタイトル" },
  { key: "description_long", label: "課題テーマ概要" },
  { key: "vision", label: "プロジェクトのビジョン（達成したい状態）" },
  { key: "current_state", label: "現状" },
  { key: "pain", label: "問題（ビジョンと現状のギャップ）" },
  { key: "root_cause", label: "問題が起きている要因" },
  { key: "focus_issue", label: "取り組むべき課題" },
  { key: "background", label: "WHY（背景）" },
  { key: "who_target", label: "WHO（ターゲット）" },
  { key: "what_benefit", label: "WHAT（提供価値）" },
  { key: "expected_outcome", label: "期待される成果" },
  { key: "what_uniqueness", label: "独自性" },
  { key: "internal_challenges", label: "実装する上でのリスク" },
  { key: "resources", label: "提供できるリソース" },
  { key: "post_action", label: "採択後のアクション" },
] as const;

export type ThemeScoreKey = (typeof THEME_SCORE_ITEMS)[number]["key"];

export interface ThemeItemScore {
  score: number;
  comment: string;
}

export interface ThemeAiScores {
  items: Partial<Record<ThemeScoreKey, ThemeItemScore>>;
  summary: string;
  threshold: number;
  scored_at?: string;
}

/** 0〜100 にクランプし 5 点刻みに丸める。 */
export function roundTo5(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v / 5) * 5));
}

/** themes 行から採点対象11項目の本文を取り出す。 */
export function buildThemeScoreContents(
  theme: Theme,
): { key: ThemeScoreKey; label: string; content: string }[] {
  const resources = [theme.prize, theme.resource_other]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join("\n");
  const map: Record<ThemeScoreKey, string> = {
    title: theme.title ?? "",
    description_long: theme.description_long ?? "",
    vision: theme.vision ?? "",
    current_state: theme.current_state ?? "",
    pain: theme.pain ?? "",
    root_cause: theme.root_cause ?? "",
    focus_issue: theme.focus_issue ?? "",
    background: theme.background ?? "",
    who_target: theme.who_target ?? "",
    what_benefit: theme.what_benefit ?? "",
    expected_outcome: theme.expected_outcome ?? "",
    what_uniqueness: theme.what_uniqueness ?? "",
    internal_challenges: theme.internal_challenges ?? "",
    resources,
    post_action: theme.post_action ?? "",
  };
  return THEME_SCORE_ITEMS.map((it) => ({
    key: it.key,
    label: it.label,
    content: (map[it.key] ?? "").trim(),
  }));
}

/** DB / API レスポンスの ai_scores を安全にパースする。 */
export function parseThemeAiScores(raw: unknown): ThemeAiScores | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const itemsRaw = obj.items;
  if (!itemsRaw || typeof itemsRaw !== "object") return null;
  const items: Partial<Record<ThemeScoreKey, ThemeItemScore>> = {};
  for (const it of THEME_SCORE_ITEMS) {
    const v = (itemsRaw as Record<string, unknown>)[it.key];
    if (v && typeof v === "object") {
      const vo = v as Record<string, unknown>;
      items[it.key] = {
        score: roundTo5(vo.score),
        comment: typeof vo.comment === "string" ? vo.comment : "",
      };
    }
  }
  if (Object.keys(items).length === 0) return null;
  return {
    items,
    summary: typeof obj.summary === "string" ? obj.summary : "",
    threshold:
      typeof obj.threshold === "number" ? obj.threshold : THEME_SCORE_THRESHOLD,
    scored_at: typeof obj.scored_at === "string" ? obj.scored_at : undefined,
  };
}

/** 70 点未満の項目を返す (申請ゲート判定用)。 */
export function themeItemsBelowThreshold(
  scores: ThemeAiScores | null,
): { key: ThemeScoreKey; label: string; score: number }[] {
  const out: { key: ThemeScoreKey; label: string; score: number }[] = [];
  for (const it of THEME_SCORE_ITEMS) {
    const score = scores?.items[it.key]?.score ?? 0;
    if (score < THEME_SCORE_THRESHOLD) {
      out.push({ key: it.key, label: it.label, score });
    }
  }
  return out;
}
