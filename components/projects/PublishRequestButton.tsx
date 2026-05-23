"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type Visibility = "private" | "submitted" | "published";

/**
 * プロジェクトをホームに公開するための申請ボタン。
 * リード / 管理者のみに表示する想定 (呼び出し側で出し分け)。
 *   private   → 「ホームに公開申請」
 *   submitted → 「公開審査中」+ 取り下げ
 *   published → 「公開中」表示のみ
 */
export function PublishRequestButton({
  projectId,
  visibility,
}: {
  projectId: string;
  visibility: Visibility;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [v, setV] = useState<Visibility>(visibility);
  const [busy, setBusy] = useState(false);

  const update = async (next: Visibility, submittedAt: string | null) => {
    setBusy(true);
    const { error } = await supabase
      .from("projects")
      .update({ visibility: next, publish_submitted_at: submittedAt })
      .eq("id", projectId);
    setBusy(false);
    if (!error) {
      setV(next);
      router.refresh();
    }
  };

  if (v === "published") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[--c-accent-soft] px-3 py-1.5 text-[12px] font-bold text-[--c-accent-deep]">
        🌐 公開中
      </span>
    );
  }

  if (v === "submitted") {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-warn/15 px-3 py-1.5 text-[12px] font-bold text-warn">
          🕓 公開審査中
        </span>
        <button
          type="button"
          onClick={() => update("private", null)}
          disabled={busy}
          className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink-2 hover:bg-mute/5 disabled:opacity-50"
        >
          取り下げ
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => update("submitted", new Date().toISOString())}
      disabled={busy}
      className="rounded-full bg-ink px-4 py-1.5 text-[12px] font-bold text-white hover:opacity-90 disabled:opacity-50"
    >
      🌐 ホームに公開申請
    </button>
  );
}
