"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";

export interface ReviewItem {
  key: string;
  label: string;
  emoji: string;
  content: string;
  /** 指定すると content の代わりに画像を表示してレビューする */
  image?: string;
}

type Decision = "approved" | "changes_requested";
type TargetType = "project" | "theme";

interface ItemState {
  decision: Decision | null;
  comment: string;
}

/**
 * 項目単位レビュー画面 (管理者専用)。プロジェクト公開審査・テーマ出題審査で共通。
 * 各項目に [承認 / 差し戻し] と コメントを付け、最後に全体を承認/差し戻しする。
 */
export function ItemReviewBoard({
  orgSlug,
  targetType,
  targetId,
  title,
  items,
  initialDecisions,
}: {
  orgSlug: string;
  targetType: TargetType;
  targetId: string;
  title: string;
  items: ReviewItem[];
  initialDecisions: Record<string, { decision: Decision; comment: string | null }>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<Record<string, ItemState>>(() => {
    const init: Record<string, ItemState> = {};
    for (const it of items) {
      const d = initialDecisions[it.key];
      init[it.key] = { decision: d?.decision ?? null, comment: d?.comment ?? "" };
    }
    return init;
  });

  const setDecision = (key: string, decision: Decision) =>
    setState((s) => ({
      ...s,
      [key]: { ...s[key], decision: s[key].decision === decision ? null : decision },
    }));
  const setComment = (key: string, comment: string) =>
    setState((s) => ({ ...s, [key]: { ...s[key], comment } }));

  const approvedCount = items.filter(
    (it) => state[it.key].decision === "approved",
  ).length;
  const changesCount = items.filter(
    (it) => state[it.key].decision === "changes_requested",
  ).length;

  const persistDecisions = async (reviewer: string | null) => {
    const rows = items
      .filter((it) => state[it.key].decision !== null)
      .map((it) => ({
        target_type: targetType,
        target_id: targetId,
        item_key: it.key,
        decision: state[it.key].decision as Decision,
        comment: state[it.key].comment.trim() || null,
        reviewed_by: reviewer,
        updated_at: new Date().toISOString(),
      }));
    if (rows.length === 0) return null;
    return supabase
      .from("review_decisions")
      .upsert(rows, { onConflict: "target_type,target_id,item_key" });
  };

  const finalize = async (approve: boolean) => {
    setBusy(true);
    setError(null);
    const reviewer = (await supabase.auth.getUser()).data.user?.id ?? null;

    const saved = await persistDecisions(reviewer);
    if (saved?.error) {
      setError(saved.error.message);
      setBusy(false);
      return;
    }

    const now = new Date().toISOString();
    const { error: e } =
      targetType === "project"
        ? await supabase
            .from("projects")
            .update({
              visibility: approve ? "published" : "private",
              publish_reviewed_at: now,
              publish_reviewed_by: reviewer,
            })
            .eq("id", targetId)
        : await supabase
            .from("themes")
            .update({
              // 承認しても即公開はしない: approved (非公開) にして、
              // 出題者が別途「公開」ボタンで active にする 2 ステップ運用。
              status: approve ? "approved" : "changes_requested",
              reviewed_at: now,
              reviewed_by: reviewer,
              review_note: approve ? null : "項目ごとのコメントを確認してください",
            })
            .eq("id", targetId);

    setBusy(false);
    if (e) {
      setError(e.message);
      return;
    }
    router.push(`/${orgSlug}/admin`);
    router.refresh();
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4 pb-28">
      <header>
        <Link href={`/${orgSlug}/admin`} className="t-cap underline">
          ← 管理者ダッシュへ
        </Link>
        <h1 className="t-h2 mt-2">📝 {title}</h1>
        <p className="t-cap mt-1">
          各項目を確認し、承認 / 差し戻しとコメントを付けてください。差し戻すと
          コメントが申請者に表示されます。
        </p>
      </header>

      {error && (
        <div className="rounded-lg bg-error/10 px-3 py-2 text-[12px] text-error">
          {error}
        </div>
      )}

      {items.map((it) => {
        const st = state[it.key];
        return (
          <GlassCard key={it.key} className="p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-[13.5px] font-bold">
                <span aria-hidden className="mr-1.5">
                  {it.emoji}
                </span>
                {it.label}
              </h3>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setDecision(it.key, "approved")}
                  className={
                    "rounded-full px-3 py-1 text-[11.5px] font-bold transition " +
                    (st.decision === "approved"
                      ? "bg-[--c-accent] text-white"
                      : "bg-mute/10 text-mute hover:bg-mute/20")
                  }
                >
                  ✓ 承認
                </button>
                <button
                  type="button"
                  onClick={() => setDecision(it.key, "changes_requested")}
                  className={
                    "rounded-full px-3 py-1 text-[11.5px] font-bold transition " +
                    (st.decision === "changes_requested"
                      ? "bg-warn text-white"
                      : "bg-mute/10 text-mute hover:bg-mute/20")
                  }
                >
                  ↩ 差し戻し
                </button>
              </div>
            </div>
            {it.image ? (
              <div className="rounded-lg overflow-hidden border border-line bg-mute/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.image}
                  alt=""
                  className="w-full max-h-72 object-contain"
                />
              </div>
            ) : (
              <div className="rounded-lg bg-mute/5 px-3 py-2 text-[12.5px] whitespace-pre-wrap leading-relaxed min-h-[40px]">
                {it.content || <span className="text-mute">（未記入）</span>}
              </div>
            )}
            <textarea
              value={st.comment}
              onChange={(e) => setComment(it.key, e.target.value)}
              placeholder="この項目へのコメント（任意）"
              rows={2}
              className="mt-2 w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent]"
            />
          </GlassCard>
        );
      })}

      {/* 固定アクションバー */}
      <div className="fixed bottom-0 left-0 right-0 md:left-[308px] z-30 border-t border-line bg-white/95 backdrop-blur px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="t-cap">
            承認 {approvedCount} / 差し戻し {changesCount} / 全 {items.length} 項目
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => finalize(false)}
              className="rounded-full border border-line px-4 py-2 text-[12.5px] font-semibold text-ink-2 hover:bg-mute/5 disabled:opacity-50"
            >
              ↩ 差し戻す
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => finalize(true)}
              className="rounded-full bg-ink px-5 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50"
              title={
                targetType === "theme"
                  ? "承認のみ。公開は出題者が「公開する」ボタンで行います"
                  : "承認して公開します"
              }
            >
              {targetType === "theme" ? "✓ 承認する" : "✓ 承認して公開"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
