"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { BadgeMedal } from "@/components/dashboard/BadgeMedal";
import {
  BADGES,
  BADGE_BY_ID,
  PROJECT_LAUNCHED_BADGE,
  type BadgeDef,
} from "@/lib/badges";
import { type ProjMember } from "@/components/projects/ProjectMembersPanel";

/** ページ側 (server) で集計して渡される静的データ */
export interface ServerSnapshot {
  meetingsCount: number;
  recurringMeetingsCount: number;
  plan: {
    why: string | null;
    who: string | null;
    what: string | null;
    how: string | null;
    product: string | null;
    price: string | null;
    place: string | null;
    promotion: string | null;
    qualitative_goal: string | null;
    scores: {
      why?: number;
      who?: number;
      what?: number;
      how?: number;
      product?: number;
      price?: number;
      place?: number;
      promotion?: number;
    } | null;
    last_observation: string | null;
  } | null;
  kpiCount: number;
  milestonesCount: number;
  tasksCount: number;
  /** 異なる month に登録されている収支アイテムのユニーク件数 */
  budgetMonths: number;
  /** チーム評価 (振り返り) を保存したユニーク user_id 数 */
  retroSubmittedUserCount: number;
  /** プロジェクトメンバー総数 (= 全員提出判定の分母) */
  memberCount: number;
}

interface Props {
  orgSlug: string;
  projectId: string;
  projectName: string;
  startedAt: string | null;
  badges: string[];
  members: ProjMember[];
  canManage: boolean;
  snapshot: ServerSnapshot;
}

/** @deprecated use PROJECT_LAUNCHED_BADGE / lib/badges.ts */
export const TEAM_FORMED_BADGE = "team_formed";

interface SubCheck {
  label: string;
  done: boolean;
}

interface Step {
  badgeId: string;
  title: string;
  href?: string;
  hint?: string;
  subChecks: SubCheck[];
  done: boolean;
}

const SCORE_THRESHOLD = 70;
const BUDGET_MONTHS_REQUIRED = 6;
const MILESTONES_REQUIRED = 5;
const TASKS_REQUIRED = 10;
const TEAM_MEMBERS_REQUIRED = 3;

function buildSteps(
  members: ProjMember[],
  snap: ServerSnapshot,
  orgSlug: string,
  projectId: string,
): Step[] {
  const base = `/${orgSlug}/projects/${projectId}`;
  const q = "";
  const plan = snap.plan;
  const scores = plan?.scores ?? {};

  // ── 1. キックオフ MTG
  const kickoffDone = snap.meetingsCount >= 1;

  // ── 2. チーム
  const hasEnoughMembers = members.length >= TEAM_MEMBERS_REQUIRED;
  const hasLead = members.some((m) => m.role === "lead");
  const hasBudgetApprover = members.some((m) => m.is_budget_approver);
  const allTitled =
    members.length > 0 && members.every((m) => !!m.title?.trim());
  const allResp =
    members.length > 0 && members.every((m) => !!m.responsibility?.trim());
  const allWork =
    members.length > 0 && members.every((m) => !!m.work_description?.trim());

  // ── 3. 定例 MTG (meeting_recurrences が 1 件以上必要。会議件数では代用不可)
  const recurringDone = snap.recurringMeetingsCount >= 1;

  // ── 4. 目標
  const goalsDone =
    !!plan?.qualitative_goal?.trim() && snap.kpiCount >= 1;

  // ── 5. Why/Who/What/How 70+
  const whyOk = (scores.why ?? 0) >= SCORE_THRESHOLD;
  const whoOk = (scores.who ?? 0) >= SCORE_THRESHOLD;
  const whatOk = (scores.what ?? 0) >= SCORE_THRESHOLD;
  const howOk = (scores.how ?? 0) >= SCORE_THRESHOLD;

  // ── 6. 4P (AI 採点で全て 70 点以上)
  const productOk = (scores.product ?? 0) >= SCORE_THRESHOLD;
  const priceOk = (scores.price ?? 0) >= SCORE_THRESHOLD;
  const placeOk = (scores.place ?? 0) >= SCORE_THRESHOLD;
  const promotionOk = (scores.promotion ?? 0) >= SCORE_THRESHOLD;

  // ── 7. チーム評価の振り返りを全員が 1 回保存している
  //    (= diagnosis_entries にメンバー全員分の row がある)
  const firstRetroDone =
    snap.memberCount > 0 &&
    snap.retroSubmittedUserCount >= snap.memberCount;

  return [
    {
      badgeId: "kickoff_done",
      title: "キックオフ MTG を開く",
      href: `${base}/meetings${q}`,
      subChecks: [
        { label: "会議が 1 件以上記録されている", done: kickoffDone },
      ],
      done: kickoffDone,
    },
    {
      badgeId: "team_formed",
      title: "チーム完成（3名以上・役割・予算決裁者）",
      href: `${base}/projects/${projectId}/members`,
      hint:
        "予算決裁者は「チーム管理 → メンバー」でメンバーの「詳細」を開き、💰 予算決裁者にするにチェックを入れてください",
      subChecks: [
        {
          label: `メンバーが ${TEAM_MEMBERS_REQUIRED} 名以上 (現在 ${members.length} 名)`,
          done: hasEnoughMembers,
        },
        { label: "プロジェクトリードがいる", done: hasLead },
        { label: "💰 予算決裁者が指定されている", done: hasBudgetApprover },
        { label: "全員の 🎖 役職 が記入済み", done: allTitled },
        { label: "全員の 🎯 責任範囲 が記入済み", done: allResp },
        { label: "全員の 🛠 業務内容 が記入済み", done: allWork },
      ],
      done:
        hasEnoughMembers &&
        hasLead &&
        hasBudgetApprover &&
        allTitled &&
        allResp &&
        allWork,
    },
    {
      badgeId: "recurring_meeting",
      title: "定例会議のルールを設定する",
      href: `${base}/meetings${q}`,
      hint:
        "会議タブの「📅 定例を設定」から 毎週 / 隔週 / 毎月 ルールを登録してください",
      subChecks: [
        {
          label: `定例会議ルールが 1 件以上 (現在 ${snap.recurringMeetingsCount} 件)`,
          done: recurringDone,
        },
      ],
      done: recurringDone,
    },
    {
      badgeId: "goals_set",
      title: "目標が設定される",
      href: `${base}/plan${q}`,
      subChecks: [
        {
          label: "定性目標 (qualitative goal) が記入済み",
          done: !!plan?.qualitative_goal?.trim(),
        },
        {
          label: "KPI が 1 件以上",
          done: snap.kpiCount >= 1,
        },
      ],
      done: goalsDone,
    },
    {
      badgeId: "why_polished",
      title: "Why/Who/What/How が全て 70 点以上",
      href: `${base}/plan${q}`,
      hint: "実行計画タブで ✦ AI からコメントをもらう を押して採点を受けてください",
      subChecks: [
        { label: `Why ≥ ${SCORE_THRESHOLD} (現在 ${scores.why ?? "?"})`, done: whyOk },
        { label: `Who ≥ ${SCORE_THRESHOLD} (現在 ${scores.who ?? "?"})`, done: whoOk },
        { label: `What ≥ ${SCORE_THRESHOLD} (現在 ${scores.what ?? "?"})`, done: whatOk },
        { label: `How ≥ ${SCORE_THRESHOLD} (現在 ${scores.how ?? "?"})`, done: howOk },
      ],
      done: whyOk && whoOk && whatOk && howOk,
    },
    {
      badgeId: "fourp_filled",
      title: "4P が全て 70 点以上",
      href: `${base}/plan${q}`,
      hint: "実行計画タブで ✦ AI からコメントをもらう を押すと 4P も採点されます",
      subChecks: [
        { label: `Product ≥ ${SCORE_THRESHOLD} (現在 ${scores.product ?? "?"})`, done: productOk },
        { label: `Price ≥ ${SCORE_THRESHOLD} (現在 ${scores.price ?? "?"})`, done: priceOk },
        { label: `Place ≥ ${SCORE_THRESHOLD} (現在 ${scores.place ?? "?"})`, done: placeOk },
        { label: `Promotion ≥ ${SCORE_THRESHOLD} (現在 ${scores.promotion ?? "?"})`, done: promotionOk },
      ],
      done: productOk && priceOk && placeOk && promotionOk,
    },
    {
      badgeId: "first_retro",
      title: "チーム評価の振り返りを全員が初回保存",
      href: `${base}/diag${q}`,
      hint:
        "チーム評価タブで全員が 14 項目に点数を入れて 💾 保存すると完了します",
      subChecks: [
        {
          label: `保存済み ${snap.retroSubmittedUserCount} / ${snap.memberCount} 名`,
          done: firstRetroDone,
        },
      ],
      done: firstRetroDone,
    },
    {
      badgeId: "milestones_set",
      title: `マイルストーンを ${MILESTONES_REQUIRED} 件以上設定`,
      href: `${base}/wbs${q}`,
      subChecks: [
        {
          label: `現在 ${snap.milestonesCount} / ${MILESTONES_REQUIRED} 件`,
          done: snap.milestonesCount >= MILESTONES_REQUIRED,
        },
      ],
      done: snap.milestonesCount >= MILESTONES_REQUIRED,
    },
    {
      badgeId: "wbs_set",
      title: `WBS タスクを ${TASKS_REQUIRED} 件以上登録`,
      href: `${base}/wbs${q}`,
      subChecks: [
        {
          label: `現在 ${snap.tasksCount} / ${TASKS_REQUIRED} 件`,
          done: snap.tasksCount >= TASKS_REQUIRED,
        },
      ],
      done: snap.tasksCount >= TASKS_REQUIRED,
    },
    {
      badgeId: "budget_set",
      title: `収支計画を半年分 (${BUDGET_MONTHS_REQUIRED} ヶ月) 作成`,
      href: `${base}/budget${q}`,
      hint: "収支アイテムに month を指定するとカウントされます",
      subChecks: [
        {
          label: `現在 ${snap.budgetMonths} / ${BUDGET_MONTHS_REQUIRED} ヶ月分`,
          done: snap.budgetMonths >= BUDGET_MONTHS_REQUIRED,
        },
      ],
      done: snap.budgetMonths >= BUDGET_MONTHS_REQUIRED,
    },
  ];
}

/** バッジ獲得条件カード + プロジェクト立ち上げ CTA */
export function LaunchReadinessCard({
  orgSlug,
  projectId,
  projectName,
  startedAt,
  badges,
  members,
  canManage,
  snapshot,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMasterBadge = badges.includes(PROJECT_LAUNCHED_BADGE);
  const isLaunched = Boolean(startedAt);

  const steps = useMemo(
    () => buildSteps(members, snapshot, orgSlug, projectId),
    [members, snapshot, orgSlug, projectId],
  );

  const totalSteps = steps.length;
  const doneSteps = steps.filter((s) => s.done).length;
  const allDone = doneSteps === totalSteps && totalSteps > 0;
  const progressPct =
    totalSteps === 0 ? 0 : Math.round((doneSteps / totalSteps) * 100);

  // 1 ステップあたりの達成率を progress (0..1) に
  const subProgressFor = (s: Step) => {
    if (s.subChecks.length === 0) return s.done ? 1 : 0;
    const d = s.subChecks.filter((c) => c.done).length;
    return d / s.subChecks.length;
  };

  /** 表示用に "獲得済み判定": 立ち上げ済みなら projects.badges を信用、
   *  まだなら条件評価ベース */
  const earnedSet = useMemo(() => {
    const set = new Set<string>();
    if (isLaunched && hasMasterBadge) {
      for (const b of badges) set.add(b);
      return set;
    }
    // 立ち上げ前: 条件評価 (visual feedback 用)。DB には書かない。
    for (const s of steps) {
      if (s.done) set.add(s.badgeId);
    }
    if (allDone) set.add(PROJECT_LAUNCHED_BADGE);
    return set;
  }, [steps, allDone, isLaunched, hasMasterBadge, badges]);

  const launch = async () => {
    if (!canManage || !allDone || launching) return;
    setLaunching(true);
    setError(null);
    // 達成済みバッジを全部 projects.badges に書き込む
    const earnedIds = new Set(badges);
    for (const s of steps) if (s.done) earnedIds.add(s.badgeId);
    earnedIds.add(PROJECT_LAUNCHED_BADGE);
    const { error: err } = await supabase
      .from("projects")
      .update({
        started_at: startedAt ?? new Date().toISOString(),
        badges: Array.from(earnedIds),
        status: "active",
      })
      .eq("id", projectId);
    setLaunching(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
  };

  return (
    <GlassCard
      className="p-5"
      style={{
        borderLeft:
          "4px solid " +
          (isLaunched && hasMasterBadge
            ? "var(--ok)"
            : allDone
              ? "var(--ok)"
              : "var(--c-accent)"),
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <span
          className="grid h-11 w-11 place-items-center rounded-2xl text-white text-lg"
          style={{
            background:
              isLaunched && hasMasterBadge
                ? "var(--ok)"
                : allDone
                  ? "var(--ok)"
                  : "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
          }}
          aria-hidden
        >
          {isLaunched && hasMasterBadge ? "🏆" : allDone ? "🏆" : "🏁"}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-extrabold text-ink leading-tight">
            {isLaunched && hasMasterBadge
              ? `🎉 ${projectName} は立ち上げ済み`
              : "プロジェクトを立ち上げる"}
          </div>
          <div className="t-cap">
            {isLaunched && hasMasterBadge
              ? `${earnedSet.size - 1} 個のバッジを獲得 ・ 開始 ${startedAt ? new Date(startedAt).toLocaleDateString("ja-JP") : ""}`
              : allDone
                ? "全 10 ステップ達成。立ち上げボタンが押せます。"
                : `10 ステップ中 ${doneSteps} 達成 — 残り ${totalSteps - doneSteps} 件で 🏆 立ち上げ完了バッジ`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[18px] font-extrabold text-ink leading-none">
            {progressPct}%
          </div>
          <div className="t-cap">達成</div>
        </div>
      </div>

      {/* progress bar */}
      <div className="h-1.5 rounded-full bg-line-soft overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${progressPct}%`,
            background: allDone
              ? "var(--ok)"
              : "linear-gradient(90deg, var(--c-accent), var(--c-accent-deep))",
          }}
        />
      </div>

      {/* バッジ棚 */}
      <div className="mb-5">
        <div className="t-label mb-2">
          🎖 バッジ ({earnedSet.size} / {BADGES.length})
        </div>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
          {BADGES.map((b) => {
            const earned = earnedSet.has(b.id);
            // master バッジは特別表示
            const step = steps.find((s) => s.badgeId === b.id);
            const prog = step ? subProgressFor(step) : earned ? 1 : 0;
            return (
              <BadgeMedal
                key={b.id}
                name={b.name}
                desc={b.desc}
                earned={earned}
                progress={earned ? undefined : prog}
                glyph={b.glyph}
              />
            );
          })}
        </div>
      </div>

      {/* ステップ詳細 */}
      {!(isLaunched && hasMasterBadge) && (
        <div className="flex flex-col gap-2 mb-4">
          <div className="t-label">📋 10 ステップの進捗</div>
          <ul className="flex flex-col gap-1.5">
            {steps.map((s, i) => {
              const badge = BADGE_BY_ID[s.badgeId];
              const subDone = s.subChecks.filter((c) => c.done).length;
              return (
                <li
                  key={s.badgeId}
                  className="rounded-lg bg-white border border-line-soft px-3 py-2"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="grid h-5 w-5 place-items-center rounded-full text-white text-[10px] font-bold flex-shrink-0"
                      style={{
                        background: s.done ? "var(--ok)" : "var(--mute)",
                      }}
                      aria-hidden
                    >
                      {s.done ? "✓" : i + 1}
                    </span>
                    <span
                      className={
                        "text-[12.5px] font-bold flex-1 min-w-0 " +
                        (s.done ? "text-ink" : "text-ink-2")
                      }
                    >
                      {s.title}
                    </span>
                    {badge && (
                      <span className="t-cap text-[10px] opacity-70">
                        🎖 {badge.name}
                      </span>
                    )}
                    {s.href && !s.done && (
                      <Link
                        href={s.href}
                        className="t-cap underline whitespace-nowrap"
                      >
                        →
                      </Link>
                    )}
                  </div>
                  {s.subChecks.length > 1 && (
                    <ul className="ml-7 mt-1 flex flex-col gap-0.5">
                      {s.subChecks.map((c, j) => (
                        <li
                          key={j}
                          className={
                            "text-[11px] " +
                            (c.done ? "text-mute opacity-70" : "text-mute")
                          }
                        >
                          <span
                            aria-hidden
                            className="inline-block w-3"
                          >
                            {c.done ? "✓" : "・"}
                          </span>
                          {c.label}
                        </li>
                      ))}
                    </ul>
                  )}
                  {s.hint && !s.done && (
                    <p className="t-cap mt-1 ml-7 opacity-80 leading-snug">
                      💡 {s.hint}
                    </p>
                  )}
                  {s.subChecks.length === 1 && !s.done && (
                    <p className="t-cap ml-7 mt-0.5 leading-snug">
                      {s.subChecks[0].label}
                    </p>
                  )}
                  {subDone < s.subChecks.length && s.subChecks.length > 1 && (
                    <p className="t-cap ml-7 mt-0.5">
                      ({subDone} / {s.subChecks.length} 完了)
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-700 mb-3">
          {error}
        </div>
      )}

      {!(isLaunched && hasMasterBadge) && (
        <button
          type="button"
          onClick={launch}
          disabled={!canManage || !allDone || launching}
          className={
            "w-full rounded-xl px-5 py-3 text-[13px] font-extrabold text-white transition " +
            (allDone && canManage
              ? "bg-ink hover:opacity-90"
              : "bg-mute opacity-50 cursor-not-allowed")
          }
          title={
            !canManage
              ? "管理者 / リードのみ立ち上げできます"
              : !allDone
                ? "10 ステップすべて完了すると押せます"
                : ""
          }
        >
          {launching
            ? "立ち上げ中…"
            : allDone
              ? "🚀 プロジェクトを立ち上げる"
              : `🔒 立ち上げまで残り ${totalSteps - doneSteps} ステップ`}
        </button>
      )}
      {!canManage && !isLaunched && (
        <p className="t-cap mt-2 text-center opacity-70">
          🔒 立ち上げボタンは管理者 / プロジェクトリードのみ押せます
        </p>
      )}
    </GlassCard>
  );
}

// 旧シンボル参照を残しておく (互換)
type _BadgeDefRef = BadgeDef;
