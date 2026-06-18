"use client";

import { useMemo, useState } from "react";

import { GlassCard } from "@/components/ui/GlassCard";
import {
  THEME_SCORE_TARGET,
  THEME_SCORE_THRESHOLD,
  parseThemeAiScores,
  themeScoreTier,
  type ThemeAiScores,
  type ThemeScoreKey,
} from "@/lib/themeScore";
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

/** themes 行から審査項目を構築。フォーム(ThemeForm)の各欄と 1:1 で対応させる。
 *  item_key は ThemeForm の noteFor / THEME_ITEM_LABEL と共通に保つこと。 */
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
    { key: "title", label: "課題テーマタイトル", emoji: "🎯", content: theme.title ?? "" },
    {
      key: "criteria",
      label: "NEO 3基準（地域 / 手段 / 若者）",
      emoji: "✅",
      content: `地域のためのテーマ: ${yn(theme.criteria_region)}\n手段であって目的でない: ${yn(theme.criteria_means)}\n若者が当事者として関われる: ${yn(theme.criteria_youth)}`,
    },
    { key: "description_long", label: "課題テーマ概要", emoji: "📝", content: theme.description_long ?? "" },
    { key: "vision", label: "プロジェクトのビジョン（達成したい状態とその状態を表す目標数値）", emoji: "🌟", content: theme.vision ?? "" },
    { key: "current_state", label: "現状", emoji: "📍", content: theme.current_state ?? "" },
    { key: "pain", label: "問題（ビジョンと現状のギャップ）", emoji: "🔥", content: theme.pain ?? "" },
    { key: "root_cause", label: "問題が起きている要因", emoji: "🧬", content: theme.root_cause ?? "" },
    { key: "focus_issue", label: "取り組むべき課題", emoji: "⛳", content: theme.focus_issue ?? "" },
    { key: "background", label: "WHY（背景）", emoji: "💡", content: theme.background ?? "" },
    { key: "who_target", label: "WHO（ターゲット）", emoji: "🧑‍🤝‍🧑", content: theme.who_target ?? "" },
    { key: "what_benefit", label: "WHAT（提供価値）", emoji: "💎", content: theme.what_benefit ?? "" },
    { key: "expected_outcome", label: "期待される成果", emoji: "🌱", content: theme.expected_outcome ?? "" },
    { key: "what_uniqueness", label: "独自性", emoji: "✨", content: theme.what_uniqueness ?? "" },
    { key: "internal_challenges", label: "実装する上でのリスク", emoji: "🪤", content: theme.internal_challenges ?? "" },
    { key: "resources", label: "提供できるリソース", emoji: "🤝", content: resources },
    { key: "post_action", label: "採択後のアクション", emoji: "🚀", content: theme.post_action ?? "" },
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
  currentUserId,
  orgAdmins = [],
  onFinalized,
}: {
  theme: Theme;
  initialDecisions: Record<string, { decision: Decision; comment: string | null }>;
  /** 現在ログインしている管理者の user_id (採点者ドロップダウンの初期値) */
  currentUserId?: string;
  /** 採点者選択候補 (組織の owner/admin) */
  orgAdmins?: { user_id: string; display_name: string | null }[];
  onFinalized: (status: Theme["status"]) => void;
}) {
  const items = useMemo(() => buildThemeReviewItems(theme), [theme]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiScores, setAiScores] = useState<ThemeAiScores | null>(() =>
    parseThemeAiScores(theme.ai_scores),
  );
  const [aiBusy, setAiBusy] = useState(false);
  // 採点者: デフォルトは current user。ドロップダウンで別の owner/admin を選んで
  // 「○○さんの代理で採点」できる。
  const [scoredAsUserId, setScoredAsUserId] = useState<string>(
    currentUserId ?? "",
  );

  const runAiScoring = async () => {
    if (aiBusy) return;
    setAiBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/score-theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeId: theme.id }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        scores?: unknown;
        error?: string;
      };
      setAiBusy(false);
      if (!res.ok || !data.ok) {
        setError(data.error ?? `AI 採点に失敗しました (${res.status})`);
        return;
      }
      setAiScores(parseThemeAiScores(data.scores));
    } catch (e) {
      setAiBusy(false);
      setError(e instanceof Error ? e.message : "AI 採点の通信に失敗しました");
    }
  };

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
        body: JSON.stringify({
          themeId: theme.id,
          approve,
          decisions,
          scored_as_user_id: scoredAsUserId || undefined,
        }),
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
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13.5px] font-bold">📝 項目ごとに審査</h3>
          <button
            type="button"
            onClick={runAiScoring}
            disabled={aiBusy}
            className="rounded-full bg-white border border-line px-3 py-1 text-[11px] font-semibold text-mute hover:text-ink disabled:opacity-50"
          >
            {aiBusy ? "🤖 採点中..." : "🤖 AIで採点"}
          </button>
        </div>

        {/* 採点者の選択。ログインしているユーザーが他の admin の代理で
            採点する場合に切り替えられる。デフォルトは current user。 */}
        {orgAdmins.length > 0 && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="t-label">👤 採点者:</span>
            <select
              value={scoredAsUserId}
              onChange={(e) => setScoredAsUserId(e.target.value)}
              className="rounded-md border border-line bg-white px-2 py-1 text-[12px] outline-none focus:border-[--c-accent]"
              title="この採点を誰の名前で記録するかを選びます (デフォルト: あなた)"
            >
              {orgAdmins.map((a) => (
                <option key={a.user_id} value={a.user_id}>
                  {a.display_name ?? "（名前未設定）"}
                  {a.user_id === currentUserId ? "（あなた）" : ""}
                </option>
              ))}
            </select>
            {scoredAsUserId && scoredAsUserId !== currentUserId && (
              <span className="t-cap text-warn">
                ※ あなた以外の管理者の代理で記録します
              </span>
            )}
          </div>
        )}

        <p className="t-cap mt-2 leading-relaxed">
          各項目に承認 / 差し戻しとコメントを付け、<strong>下の「差し戻す」または「承認して公開」</strong>で確定してください。差し戻したコメントは出題者に表示されます。
          {aiScores && (
            <>
              {" "}AI 採点（申請ライン {THEME_SCORE_THRESHOLD} 点 / 目標 {THEME_SCORE_TARGET} 点）は各項目に表示されます。
            </>
          )}
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
              {(() => {
                const ai = aiScores?.items[it.key as ThemeScoreKey];
                if (!ai) return null;
                const tier = themeScoreTier(ai.score);
                const wrapCls =
                  tier === "target"
                    ? "bg-accent-soft/60"
                    : tier === "min"
                      ? "bg-canvas-2"
                      : "bg-warn/10";
                const badgeCls =
                  tier === "target"
                    ? "bg-[--c-accent] text-white"
                    : tier === "min"
                      ? "bg-mute text-white"
                      : "bg-warn text-white";
                const badgeMark =
                  tier === "target" ? "🎯" : tier === "min" ? "✓" : "↑";
                const tierNote =
                  tier === "target"
                    ? `目標水準（${THEME_SCORE_TARGET}点）達成`
                    : tier === "min"
                      ? `申請可能・目標 ${THEME_SCORE_TARGET}点 未達`
                      : `申請ライン ${THEME_SCORE_THRESHOLD}点 未達`;
                return (
                  <div className={"mb-2 rounded-md px-2.5 py-1.5 " + wrapCls}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold " +
                          badgeCls
                        }
                      >
                        {badgeMark} 🤖 {ai.score} 点
                      </span>
                      <span className="t-cap">{tierNote}</span>
                    </div>
                    {ai.comment && (
                      <p className="t-cap mt-1 leading-relaxed">{ai.comment}</p>
                    )}
                  </div>
                );
              })()}
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
