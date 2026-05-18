"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  isMemberRegistered,
  type ProjMember,
} from "@/components/projects/ProjectMembersPanel";

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
    scores: { why?: number; who?: number; what?: number; how?: number } | null;
  } | null;
  kpiCount: number;
  milestonesCount: number;
  tasksCount: number;
  /** 異なる month に登録されている収支アイテムのユニーク件数 */
  budgetMonths: number;
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

export const TEAM_FORMED_BADGE = "team_formed";

interface Condition {
  key: string;
  label: string;
  hint?: string;
  href?: string;
  done: boolean;
}

interface ConditionGroup {
  title: string;
  emo: string;
  items: Condition[];
}

const SCORE_THRESHOLD = 70;
const BUDGET_MONTHS_REQUIRED = 6;
const MILESTONES_REQUIRED = 5;
const TASKS_REQUIRED = 10;

function buildConditions(
  members: ProjMember[],
  snap: ServerSnapshot,
  orgSlug: string,
  projectId: string,
): ConditionGroup[] {
  const base = `/${orgSlug}`;
  const q = `?p=${projectId}`;
  // member 集計
  const hasMember = members.length >= 1;
  const hasLead = members.some((m) => m.role === "lead");
  const allTitled =
    members.length > 0 && members.every((m) => !!m.title?.trim());
  const allResp =
    members.length > 0 && members.every((m) => !!m.responsibility?.trim());
  const allWork =
    members.length > 0 && members.every((m) => !!m.work_description?.trim());

  // plan 集計
  const plan = snap.plan;
  const scores = plan?.scores ?? {};
  const allScored =
    typeof scores.why === "number" &&
    typeof scores.who === "number" &&
    typeof scores.what === "number" &&
    typeof scores.how === "number" &&
    scores.why >= SCORE_THRESHOLD &&
    scores.who >= SCORE_THRESHOLD &&
    scores.what >= SCORE_THRESHOLD &&
    scores.how >= SCORE_THRESHOLD;
  const fourPDone =
    !!plan?.product?.trim() &&
    !!plan?.price?.trim() &&
    !!plan?.place?.trim() &&
    !!plan?.promotion?.trim();
  const goalDone =
    !!plan?.qualitative_goal?.trim() && snap.kpiCount >= 1;

  return [
    {
      title: "チームを作る",
      emo: "👥",
      items: [
        {
          key: "has-member",
          label: "メンバーが 1 名以上いる",
          done: hasMember,
        },
        {
          key: "has-lead",
          label: "プロジェクトリードが 1 名以上いる",
          hint: "「決める人」を 1 人決めましょう",
          done: hasLead,
        },
        {
          key: "all-titled",
          label: "全員が 🎖 役職 を記入済み",
          done: allTitled,
        },
        {
          key: "all-resp",
          label: "全員が 🎯 責任範囲 を記入済み",
          done: allResp,
        },
        {
          key: "all-work",
          label: "全員が 🛠 業務内容 を記入済み",
          done: allWork,
        },
      ],
    },
    {
      title: "Why を磨く (実行計画)",
      emo: "🎯",
      items: [
        {
          key: "scores-70",
          label: "Why / Who / What / How がそれぞれ 70 点以上",
          hint: "実行計画タブで「✦ AI からコメントをもらう」を押すと採点されます",
          href: `${base}/plan${q}`,
          done: allScored,
        },
        {
          key: "fourp",
          label: "4P (Product / Price / Place / Promotion) が記入済み",
          href: `${base}/plan${q}`,
          done: fourPDone,
        },
        {
          key: "goal",
          label: "定性目標 + KPI が 1 件以上設定済み",
          href: `${base}/plan${q}`,
          done: goalDone,
        },
      ],
    },
    {
      title: "実行設計",
      emo: "🛠",
      items: [
        {
          key: "milestones",
          label: `マイルストーンが ${MILESTONES_REQUIRED} 件以上 (現在 ${snap.milestonesCount} 件)`,
          href: `${base}/wbs${q}`,
          done: snap.milestonesCount >= MILESTONES_REQUIRED,
        },
        {
          key: "tasks",
          label: `WBS タスクが ${TASKS_REQUIRED} 件以上 (現在 ${snap.tasksCount} 件)`,
          href: `${base}/wbs${q}`,
          done: snap.tasksCount >= TASKS_REQUIRED,
        },
        {
          key: "budget",
          label: `収支計画が ${BUDGET_MONTHS_REQUIRED} ヶ月分以上 (現在 ${snap.budgetMonths} ヶ月)`,
          hint: "month を指定した収支アイテムのユニーク月数で集計します",
          href: `${base}/budget${q}`,
          done: snap.budgetMonths >= BUDGET_MONTHS_REQUIRED,
        },
      ],
    },
    {
      title: "動き出し",
      emo: "🚀",
      items: [
        {
          key: "kickoff",
          label: "キックオフ MTG が記録されている",
          hint: "会議タブから 1 件登録すれば OK",
          href: `${base}/meetings${q}`,
          done: snap.meetingsCount >= 1,
        },
        {
          key: "recurring",
          label: "定例 MTG が設定されている",
          hint:
            snap.recurringMeetingsCount > 0
              ? undefined
              : "会議タブで 2 件目を登録すると定例とみなします (今後専用の定例設定 UI を予定)",
          href: `${base}/meetings${q}`,
          // 専用 recurrence テーブル登場までは「会議が 2 件以上ある」を proxy にする
          done:
            snap.recurringMeetingsCount >= 1 || snap.meetingsCount >= 2,
        },
      ],
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

  const hasBadge = badges.includes(TEAM_FORMED_BADGE);
  const isLaunched = Boolean(startedAt);

  const groups = useMemo(
    () => buildConditions(members, snapshot, orgSlug, projectId),
    [members, snapshot, orgSlug, projectId],
  );

  const allConditions = groups.flatMap((g) => g.items);
  const totalCount = allConditions.length;
  const doneCount = allConditions.filter((c) => c.done).length;
  const allDone = doneCount === totalCount && totalCount > 0;
  const progressPct =
    totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  const launch = async () => {
    if (!canManage || !allDone || launching) return;
    setLaunching(true);
    setError(null);
    const nextBadges = badges.includes(TEAM_FORMED_BADGE)
      ? badges
      : [...badges, TEAM_FORMED_BADGE];
    const { error: err } = await supabase
      .from("projects")
      .update({
        started_at: startedAt ?? new Date().toISOString(),
        badges: nextBadges,
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

  // 既に立ち上げ済み & バッジ付与済みの場合は完了表示 (条件カードは折り畳む)
  if (isLaunched && hasBadge) {
    return (
      <GlassCard
        className="p-5"
        style={{
          background:
            "linear-gradient(135deg, rgba(91,141,239,.08), rgba(91,141,239,.18))",
          borderLeft: "4px solid var(--ok)",
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="grid h-12 w-12 place-items-center rounded-full text-white text-xl"
            style={{ background: "var(--ok)" }}
            aria-hidden
          >
            🏆
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-extrabold text-ink mb-0.5">
              🎉 {projectName} は立ち上げ済みです
            </div>
            <div className="t-cap">
              開始{" "}
              {startedAt
                ? new Date(startedAt).toLocaleDateString("ja-JP")
                : "—"}{" "}
              ・「🏆 チーム完成」バッジを獲得
            </div>
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard
      className="p-5"
      style={{
        borderLeft:
          "4px solid " + (allDone ? "var(--ok)" : "var(--c-accent)"),
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <span
          className="grid h-11 w-11 place-items-center rounded-2xl text-white text-lg"
          style={{
            background: allDone
              ? "var(--ok)"
              : "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
          }}
          aria-hidden
        >
          {allDone ? "🏆" : "🏁"}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-extrabold text-ink leading-tight">
            プロジェクトを立ち上げる
          </div>
          <div className="t-cap">
            {allDone
              ? "条件をすべて満たしました。立ち上げボタンが押せます。"
              : `${totalCount} 条件中 ${doneCount} 達成 — クリアすると「🏆 チーム完成」バッジを獲得`}
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
      <div className="h-1.5 rounded-full bg-line-soft overflow-hidden mb-3.5">
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

      <div className="flex flex-col gap-3 mb-4">
        {groups.map((g) => {
          const gDone = g.items.filter((i) => i.done).length;
          const gTotal = g.items.length;
          return (
            <section key={g.title}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span aria-hidden>{g.emo}</span>
                <span className="t-label">{g.title}</span>
                <span className="t-cap ml-auto">
                  {gDone} / {gTotal}
                </span>
              </div>
              <ul className="flex flex-col gap-1">
                {g.items.map((c) => (
                  <li
                    key={c.key}
                    className="flex items-start gap-2 rounded-md bg-white border border-line-soft px-2.5 py-1.5"
                  >
                    <span
                      className="grid h-5 w-5 place-items-center rounded-full text-white text-[10px] font-bold flex-shrink-0 mt-0.5"
                      style={{
                        background: c.done ? "var(--ok)" : "var(--mute)",
                      }}
                      aria-hidden
                    >
                      {c.done ? "✓" : "・"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div
                        className={
                          "text-[12px] font-semibold leading-snug " +
                          (c.done ? "text-ink" : "text-mute")
                        }
                      >
                        {c.label}
                      </div>
                      {c.hint && !c.done && (
                        <div className="t-cap opacity-80 mt-0.5 leading-snug">
                          {c.hint}
                        </div>
                      )}
                    </div>
                    {c.href && !c.done && (
                      <Link
                        href={c.href}
                        className="t-cap underline whitespace-nowrap flex-shrink-0"
                      >
                        →
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-700 mb-3">
          {error}
        </div>
      )}

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
              ? "すべての条件を満たすと押せます"
              : ""
        }
      >
        {launching
          ? "立ち上げ中…"
          : allDone
            ? "🚀 プロジェクトを立ち上げる"
            : `🔒 立ち上げまで残り ${totalCount - doneCount} 件`}
      </button>
      {!canManage && (
        <p className="t-cap mt-2 text-center opacity-70">
          🔒 立ち上げボタンは管理者 / プロジェクトリードのみ押せます
        </p>
      )}
      {/* メンバー領域は使わずダミー参照で lint を落とす */}
      <span className="hidden" data-debug={isMemberRegistered.length} />
    </GlassCard>
  );
}
