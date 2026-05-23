export type ThemeStatus =
  | "draft"
  | "submitted"
  | "changes_requested"
  | "active"
  | "closed"
  | "archived";

export const THEME_STATUS_META: Record<
  ThemeStatus,
  { label: string; emo: string; color: string; hint: string }
> = {
  draft: {
    label: "記載中",
    emo: "📝",
    color: "var(--mute)",
    hint: "下書き。まだ応募者には表示されません。",
  },
  submitted: {
    label: "審査中",
    emo: "⏳",
    color: "var(--warn)",
    hint: "申請済み。管理者の審査を待っています。",
  },
  changes_requested: {
    label: "差し戻し",
    emo: "↩️",
    color: "var(--error, #ff5468)",
    hint: "修正のうえ、再度申請してください。",
  },
  active: {
    label: "公開中",
    emo: "🟢",
    color: "var(--ok)",
    hint: "テーマ応募一覧に公開されています。",
  },
  closed: {
    label: "終了",
    emo: "📦",
    color: "var(--warn)",
    hint: "募集を終了しました。",
  },
  archived: {
    label: "アーカイブ",
    emo: "🗄",
    color: "var(--mute-2)",
    hint: "アーカイブ済みです。",
  },
};

export function themeStatusMeta(status: string) {
  return THEME_STATUS_META[status as ThemeStatus] ?? THEME_STATUS_META.draft;
}
