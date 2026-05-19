"use client";

import { useState } from "react";
import Link from "next/link";

import { AIScoreCard } from "@/components/projects/AIScoreCard";
import { LaunchReadinessCard } from "@/components/projects/LaunchReadinessCard";
import {
  ProjectMembersPanel,
  type ProjMember,
} from "@/components/projects/ProjectMembersPanel";
import { MemberInfoPanel } from "@/components/projects/MemberInfoPanel";
import type { ServerSnapshot } from "@/components/projects/LaunchReadinessCard";
import type { ProjectScore } from "@/lib/projectScore";

interface OrgMember {
  user_id: string;
  org_role: "owner" | "admin" | "member" | "theme_owner";
  display_name: string | null;
}

interface Props {
  orgSlug: string;
  projectId: string;
  projectName: string;
  startedAt: string | null;
  badges: string[];
  canManage: boolean;
  orgMembers: OrgMember[];
  initialMembers: ProjMember[];
  snapshot: ServerSnapshot;
  score: ProjectScore;
  /** チーム振り返り (DiagBoard) の本体。既存ロジック温存のため node を受け取る */
  retroBoard: React.ReactNode;
}

type Tab = "score" | "badges" | "retro" | "info" | "add";

const TABS: { key: Tab; label: string; emo: string }[] = [
  { key: "score", label: "総合評価", emo: "✦" },
  { key: "badges", label: "バッジ", emo: "🏅" },
  { key: "retro", label: "チーム振り返り", emo: "💗" },
  { key: "info", label: "メンバー情報", emo: "👤" },
  { key: "add", label: "メンバー追加", emo: "＋" },
];

export function TeamManagementBody({
  orgSlug,
  projectId,
  projectName,
  startedAt,
  badges,
  canManage,
  orgMembers,
  initialMembers,
  snapshot,
  score,
  retroBoard,
}: Props) {
  const [tab, setTab] = useState<Tab>("score");
  const [members, setMembers] = useState<ProjMember[]>(initialMembers);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Link
            href={`/${orgSlug}/dashboard?p=${projectId}`}
            className="t-cap underline"
          >
            ← {projectName} のダッシュボードへ
          </Link>
          <h1 className="t-h2 mt-2">
            <span aria-hidden className="mr-2">
              🏢
            </span>
            チーム管理
          </h1>
          <p className="t-cap mt-1">
            {projectName} — 総合評価 / バッジ / 振り返り / メンバー情報 / 追加
          </p>
        </div>
      </header>

      {/* タブ */}
      <nav className="flex items-center gap-1.5 flex-wrap">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition " +
                (active
                  ? "bg-ink text-white"
                  : "bg-white text-mute border border-line-soft hover:text-ink")
              }
            >
              <span aria-hidden>{t.emo}</span>
              {t.label}
            </button>
          );
        })}
      </nav>

      {tab === "score" && <AIScoreCard score={score} />}

      {tab === "badges" && (
        <LaunchReadinessCard
          orgSlug={orgSlug}
          projectId={projectId}
          projectName={projectName}
          startedAt={startedAt}
          badges={badges}
          members={members}
          canManage={canManage}
          snapshot={snapshot}
        />
      )}

      {tab === "retro" && retroBoard}

      {tab === "info" && <MemberInfoPanel members={members} />}

      {tab === "add" && (
        <ProjectMembersPanel
          projectId={projectId}
          canManage={canManage}
          orgMembers={orgMembers}
          initialMembers={initialMembers}
          onMembersChange={setMembers}
        />
      )}
    </div>
  );
}
