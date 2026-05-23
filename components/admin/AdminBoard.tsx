"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { GlassCard } from "@/components/ui/GlassCard";
import { OrgSummaryCards } from "@/components/admin/OrgSummaryCards";
import { ProjectMonitor } from "@/components/admin/ProjectMonitor";
import { QuestEditor } from "@/components/admin/QuestEditor";
import { MemberActivityTable } from "@/components/admin/MemberActivityTable";
import { BadgeManager } from "@/components/admin/BadgeManager";
import {
  ReviewQueue,
  type PendingProject,
  type PendingTheme,
} from "@/components/admin/ReviewQueue";
import type {
  MemberActivity,
  OrgSummary,
  ProjectStats,
} from "@/lib/admin";
import type { Database } from "@/lib/types/database";

type Quest = Database["public"]["Tables"]["quests"]["Row"];
type QuestItem = Database["public"]["Tables"]["quest_items"]["Row"];
type Badge = Database["public"]["Tables"]["badges"]["Row"];
type Award = Database["public"]["Tables"]["badge_awards"]["Row"];

interface Props {
  orgSlug: string;
  orgId: string;
  orgName: string;
  summary: OrgSummary;
  projectStats: ProjectStats[];
  memberActivity: MemberActivity[];
  quests: Quest[];
  questItems: QuestItem[];
  badges: Badge[];
  badgeAwards: Award[];
  hasAnthropic: boolean;
  canDeleteProjects?: boolean;
  pendingProjects?: PendingProject[];
  pendingThemes?: PendingTheme[];
}

type Tab = "monitor" | "review" | "quests" | "badges" | "members";

export function AdminBoard({
  orgSlug,
  orgId,
  orgName,
  summary,
  projectStats,
  memberActivity,
  quests,
  questItems,
  badges,
  badgeAwards,
  hasAnthropic,
  canDeleteProjects = false,
  pendingProjects = [],
  pendingThemes = [],
}: Props) {
  const [tab, setTab] = useState<Tab>("monitor");
  const reviewCount = pendingProjects.length + pendingThemes.length;

  const stalledCount = useMemo(
    () => projectStats.filter((p) => p.health === "stalled").length,
    [projectStats],
  );
  const watchCount = useMemo(
    () => projectStats.filter((p) => p.health === "watch").length,
    [projectStats],
  );

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {/* Header */}
      <GlassCard className="p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="grid h-12 w-12 place-items-center rounded-2xl text-white text-xl"
            style={{
              background:
                "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
            }}
          >
            ⚙️
          </span>
          <div className="min-w-0">
            <h1 className="text-[18px] font-extrabold tracking-tight truncate">
              管理者ダッシュボード
            </h1>
            <div className="t-cap truncate">
              {orgName} — 状態監視・クエスト・メンバー管理
            </div>
          </div>
        </div>
        <Link
          href={`/${orgSlug}`}
          className="rounded-full bg-white px-3 py-1.5 text-[11.5px] font-semibold text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)]"
        >
          ← ランキングへ戻る
        </Link>
      </GlassCard>

      <OrgSummaryCards summary={summary} stalledCount={stalledCount} />

      {/* Tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <TabPill
          label="📡 プロジェクト監視"
          count={projectStats.length}
          badge={stalledCount + watchCount > 0 ? stalledCount + watchCount : null}
          active={tab === "monitor"}
          onClick={() => setTab("monitor")}
        />
        <TabPill
          label="📝 審査"
          count={reviewCount}
          badge={reviewCount > 0 ? reviewCount : null}
          active={tab === "review"}
          onClick={() => setTab("review")}
        />
        <TabPill
          label="🎯 クエスト管理"
          count={quests.length}
          active={tab === "quests"}
          onClick={() => setTab("quests")}
        />
        <TabPill
          label="🏅 バッジ管理"
          count={badges.length}
          active={tab === "badges"}
          onClick={() => setTab("badges")}
        />
        <TabPill
          label="👥 メンバー活動"
          count={memberActivity.length}
          active={tab === "members"}
          onClick={() => setTab("members")}
        />
      </div>

      {tab === "monitor" && (
        <ProjectMonitor
          orgSlug={orgSlug}
          projects={projectStats}
          hasAnthropic={hasAnthropic}
          canDelete={canDeleteProjects}
        />
      )}

      {tab === "review" && (
        <ReviewQueue
          orgSlug={orgSlug}
          pendingProjects={pendingProjects}
          pendingThemes={pendingThemes}
        />
      )}

      {tab === "quests" && (
        <QuestEditor
          orgId={orgId}
          orgSlug={orgSlug}
          initialQuests={quests}
          initialItems={questItems}
          projects={projectStats}
        />
      )}

      {tab === "badges" && (
        <BadgeManager
          orgId={orgId}
          initialBadges={badges}
          initialAwards={badgeAwards}
          projects={projectStats}
        />
      )}

      {tab === "members" && (
        <MemberActivityTable
          orgSlug={orgSlug}
          members={memberActivity}
        />
      )}
    </div>
  );
}

function TabPill({
  label,
  count,
  badge,
  active,
  onClick,
}: {
  label: string;
  count: number;
  badge?: number | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition " +
        (active
          ? "bg-ink text-white"
          : "bg-white text-mute hover:bg-mute/5 shadow-[0_1px_0_var(--line-soft)]")
      }
    >
      <span>{label}</span>
      <span
        className={
          "rounded-full px-1.5 text-[10px] " +
          (active ? "bg-white/20" : "bg-mute/10 text-mute")
        }
      >
        {count}
      </span>
      {badge !== null && badge !== undefined && badge > 0 && (
        <span className="rounded-full bg-warn px-1.5 text-[10px] font-bold text-white">
          ⚠ {badge}
        </span>
      )}
    </button>
  );
}
