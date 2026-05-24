import Link from "next/link";

type Visibility = "private" | "submitted" | "published";

/**
 * プロジェクト公開のステータス表示 + 申請フォームへの導線。
 * リード / 管理者のみに表示する想定 (呼び出し側で出し分け)。
 *   private   → 「公開申請を作成」(申請フォームへ)
 *   submitted → 「公開審査中」+ 申請内容を編集
 *   published → 「公開中」表示のみ
 */
export function PublishRequestButton({
  orgSlug,
  projectId,
  visibility,
}: {
  orgSlug: string;
  projectId: string;
  visibility: Visibility;
}) {
  const href = `/${orgSlug}/projects/${projectId}/publish`;

  if (visibility === "published") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[--c-accent-soft] px-3 py-1.5 text-[12px] font-bold text-[--c-accent-deep]">
        🌐 公開中
      </span>
    );
  }

  if (visibility === "submitted") {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-warn/15 px-3 py-1.5 text-[12px] font-bold text-warn">
          🕓 公開審査中
        </span>
        <Link
          href={href}
          className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink-2 hover:bg-mute/5"
        >
          申請内容を見る
        </Link>
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="inline-block rounded-full bg-ink px-4 py-1.5 text-[12px] font-bold text-white hover:opacity-90"
    >
      🌐 ホームに公開申請
    </Link>
  );
}
