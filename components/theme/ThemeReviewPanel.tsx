"use client";

import { useMemo, useState } from "react";

import { GlassCard } from "@/components/ui/GlassCard";
import type { Database } from "@/lib/types/database";

type Theme = Database["public"]["Tables"]["themes"]["Row"];
type Decision = "approved" | "changes_requested";

interface ReviewItem {
  key: string;
  label: string;
  emoji: string;
  content: string;
  image?: string;
}

interface ItemState {
  decision: Decision | null;
  comment: string;
}

/** themes 行から審査項目を構築 (プレビューに出る内容に揃える)。
 *  item_key は admin/review/theme と共通に保つこと。 */
export function buildThemeReviewItems(theme: Theme): ReviewItem[] {
  const yn = (b: boolean | null) => (b ? "✓" : "✗");
  const resources = [theme.prize, theme.resource_other]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join("\n");
  return [
    {
      key: "image",
      label: "サムネ画像",
      emoji: "🖼",
      content: theme.thumbnail_url ? "" : "（画像が設定されていません）",
      image: theme.thumbnail_url || undefined,
    },
    { key: "title", label: "課題テーマ", emoji: "🎯", content: theme.title ?? "" },
    { key: "background", label: "背景 / 概要", emoji: "📖", content: theme.background ?? theme.description_long ?? "" },
    { key: "who_target", label: "対象（誰の課題か）", emoji: "👥", content: theme.who_target ?? "" },
    { key: "pain", label: "問題", emoji: "😣", content: theme.pain ?? "" },
    { key: "what_benefit", label: "提供価値", emoji: "🎁", content: theme.what_benefit ?? "" },
    { key: "expected_outcome", label: "期待される成果", emoji: "📈", content: theme.expected_outcome ?? "" },
    { key: "what_uniqueness", label: "独自性", emoji: "💎", content: theme.what_uniqueness ?? "" },
    {
      key: "criteria",
      label: "3基準（地域 / 手段 / 若者）",
      emoji: "✅",
      content: `地域のためのテーマ: ${yn(theme.criteria_region)}\n手段であって目的でない: ${yn(theme.criteria_means)}\n若者が当事者として関われる: ${yn(theme.criteria_youth)}`,
    },
    { key: "resources", label: "提供リソース", emoji: "🧰", content: resources },
  ];
}

/**
 * テーマ審査の右サイドパネル。左のプレビューを見ながら、各項目に
 * 承認 / 差し戻し + コメントを付け、まとめて承認/差し戻しする。
 * (旧: 別画面 admin/review/theme の ItemReviewBoard を ThemeStudio 内に内包)
 */
export function ThemeReviewPanel({
  theme,
  initialDecisions,
  onFinalized,
}: {
  theme: Theme;
  initialDecisions: Record<string, { decision: Decision; comment: string | null }>;
  onFinalized: (status: Theme["status"]) => void;
}) {
  const items = useMemo(() => buildThemeReviewItems(theme), [theme]);
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
      [key]: {
        ...s[key],
        decision: s[key].decision === decision ? null : decision,
      },
    }));
  const setComment = (key: string, comment: string) =>
    setState((s) => ({ ...s, [key]: { ...s[key], comment } }));

  const approvedCount = items.filter(
    (it) => state[it.key].decision === "approved",
  ).length;
  const changesCount = items.filter(
    (it) => state[it.key].decision === "changes_requested",
  ).length;

  const finalize = async (approve: boolean) => {
    setBusy(true);
    setError(null);

    // 判定が付いた項目 + コメントが書かれた項目を送る (サーバ側で確定保存)。
    const decisions = items
      .filter(
        (it) =>
          state[it.key].decision !== null ||
          state[it.key].comment.trim() !== "",
      )
      .map((it) => ({
        item_key: it.key,
        decision: state[it.key].decision,
        comment: state[it.key].comment.trim() || null,
      }));

    try {
      const res = await fetch("/api/themes/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeId: theme.id, approve, decisions }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        status?: Theme["status"];
        error?: string;
      };
      setBusy(false);
      if (!res.ok || !data.ok) {
        setError(data.error ?? `保存に失敗しました (${res.status})`);
        return;
      }
      onFinalized(data.status ?? (approve ? "active" : "changes_requested"));
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "通信に失敗しました");
    }
  };

  return (
    <GlassCard className="p-0 overflow-hidden flex flex-col max-h-[calc(100vh-120px)]">
      <div className="px-4 py-3 border-b border-line-soft bg-canvas-2/60">
        <h3 className="text-[13.5px] font-bold">📝 項目ごとに審査</h3>
        <p className="t-cap mt-0.5 leading-relaxed">
          各項目に承認 / 差し戻しとコメントを付け、<strong>下の「差し戻す」または「承認して公開」</strong>で確定してください。差し戻したコメントは出題者に表示されます。
        </p>
      </div>

      <div className="flex flex-col gap-3 p-4 overflow-y-auto min-h-0 flex-1">
        {items.map((it) => {
          const st = state[it.key];
          return (
            <div
              key={it.key}
              className="rounded-lg border border-line-soft p-3"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <h4 className="text-[12.5px] font-bold">
                  <span aria-hidden className="mr-1.5">
                    {it.emoji}
                  </span>
                  {it.label}
                </h4>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setDecision(it.key, "approved")}
                    className={
                      "rounded-full px-2.5 py-1 text-[11px] font-bold transition " +
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
                      "rounded-full px-2.5 py-1 text-[11px] font-bold transition " +
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
                <div className="rounded-md overflow-hidden border border-line bg-mute/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={it.image}
                    alt=""
                    className="w-full max-h-40 object-contain"
                  />
                </div>
              ) : (
                <div className="rounded-md bg-mute/5 px-2.5 py-1.5 text-[12px] whitespace-pre-wrap leading-relaxed min-h-[34px]">
                  {it.content || <span className="text-mute">（未記入）</span>}
                </div>
              )}
              <textarea
                value={st.comment}
                onChange={(e) => setComment(it.key, e.target.value)}
                placeholder="この項目へのコメント（差し戻し時は必須級）"
                rows={2}
                className="mt-2 w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent] resize-none"
              />
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mx-4 mb-2 rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-700">
          {error}
        </div>
      )}

      <div className="border-t border-line-soft px-4 py-3 bg-white/70">
        <div className="t-cap mb-2">
          承認 {approvedCount} / 差し戻し {changesCount} / 全 {items.length} 項目
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => finalize(false)}
            className="flex-1 rounded-full border border-line px-4 py-2 text-[12.5px] font-semibold text-error hover:bg-red-50 disabled:opacity-50"
          >
            ↩ 差し戻す
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => finalize(true)}
            className="flex-1 rounded-full bg-ink px-5 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            ✓ 承認して公開
          </button>
        </div>
      </div>
    </GlassCard>
  );
}
