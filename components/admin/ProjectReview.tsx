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
}

type Decision = "approved" | "changes_requested";

interface ItemState {
  decision: Decision | null;
  comment: string;
}

/**
 * プロジェクト公開申請の「項目単位レビュー」画面 (管理者専用)。
 * 各項目に [承認 / 差し戻し] と コメントを付け、最後に全体を
 * 「承認して公開」または「差し戻し」する。
 */
export function ProjectReview({
  orgSlug,
  projectId,
  projectName,
  items,
  initialDecisions,
}: {
  orgSlug: string;
  projectId: string;
  projectName: string;
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
        target_type: "project" as const,
        target_id: projectId,
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

    const { error: e } = await supabase
      .from("projects")
      .update({
        visibility: approve ? "published" : "private",
        publish_reviewed_at: new Date().toISOString(),
        publish_reviewed_by: reviewer,
      })
      .eq("id", projectId);
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
        <h1 className="t-h2 mt-2">📝 公開審査 — {projectName}</h1>
        <p className="t-cap mt-1">
          各項目を確認し、承認 / 差し戻しとコメントを付けてください。差し戻すと
          コメントが申請者（リード）に表示されます。
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
            <div className="rounded-lg bg-mute/5 px-3 py-2 text-[12.5px] whitespace-pre-wrap leading-relaxed min-h-[40px]">
              {it.content || (
                <span className="text-mute">（未記入）</span>
              )}
            </div>
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
            >
              ✓ 承認して公開
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
