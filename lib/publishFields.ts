/** プロジェクト公開申請フォームの項目定義 (フォーム / 審査 / フィードバックで共通利用)。 */
export const PUBLISH_FIELDS = [
  { key: "title", label: "プロジェクトタイトル", emoji: "🏷️", multiline: false },
  { key: "summary", label: "プロジェクト概要", emoji: "📝", multiline: true },
  { key: "why", label: "Why（なぜ・誰のために）", emoji: "💡", multiline: true },
  { key: "who", label: "Who（誰の・どんな状況）", emoji: "👥", multiline: true },
  { key: "problem", label: "問題", emoji: "😣", multiline: true },
  { key: "what", label: "What（提供価値）", emoji: "💎", multiline: true },
  { key: "outcome", label: "期待される成果", emoji: "📈", multiline: true },
  { key: "uniqueness", label: "独自性", emoji: "✨", multiline: true },
] as const;

export type PublishFieldKey = (typeof PUBLISH_FIELDS)[number]["key"];

export interface PublishApp {
  image_url?: string;
  title?: string;
  summary?: string;
  why?: string;
  who?: string;
  problem?: string;
  what?: string;
  outcome?: string;
  uniqueness?: string;
}

export const PUBLISH_FIELD_LABEL: Record<string, string> = Object.fromEntries(
  PUBLISH_FIELDS.map((f) => [f.key, f.label]),
);
