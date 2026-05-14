"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { GlassCard } from "@/components/ui/GlassCard";
import { RingV2 } from "@/components/ui/RingV2";
import { StatusDot } from "@/components/ui/StatusDot";
import {
  TimelineFeed,
  type PostAuthor,
  type ProjectLite,
  type TimelinePost,
} from "@/components/timeline/TimelineFeed";
import type { Database } from "@/lib/types/database";
import type { ProjectAccess } from "@/lib/projects";

type Project = Database["public"]["Tables"]["projects"]["Row"] & {
  access: ProjectAccess;
};

interface QuestItem {
  id: string;
  label: string;
  position: number;
  done_count: number;
  target_count: number;
}

interface Quest {
  id: string;
  title: string;
  emoji: string | null;
  ends_at: string;
}

interface Props {
  orgSlug: string;
  orgName: string;
  currentUserId: string | null;
  initialTab: "list" | "ranking" | "timeline";
  projects: Project[];
  currentQuest: Quest | null;
  questItems: QuestItem[];
  daysLeft: number;
  timelinePosts: TimelinePost[];
  timelineAuthors: [string, PostAuthor][];
  composeProjects: ProjectLite[];
}

export function HomeBoard({
  orgSlug,
  orgName,
  currentUserId,
  initialTab,
  projects,
  currentQuest,
  questItems,
  daysLeft,
  timelinePosts,
  timelineAuthors,
  composeProjects,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"list" | "ranking" | "timeline">(initialTab);
  const authorsById = useMemo(() => new Map(timelineAuthors), [timelineAuthors]);

  const active = projects.filter((p) => p.status === "active");
  const others = projects.filter((p) => p.status !== "active");

  const switchTab = (t: "list" | "ranking" | "timeline") => {
    setTab(t);
    const url = new URL(window.location.href);
    if (t === "list") url.searchParams.delete("tab");
    else url.searchParams.set("tab", t);
    history.replaceState({}, "", url.toString());
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-4 lg:gap-5">
      {/* 左カラム */}
      <div className="flex flex-col gap-4 lg:gap-5 min-w-0">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h2 className="t-h2">
              <span aria-hidden className="mr-2">
                🏠
              </span>
              {orgName} ホーム
            </h2>
            <p className="t-cap">
              プロジェクトの全体像とチーム活動が一望できます
            </p>
          </div>
          <Link
            href={`/${orgSlug}/projects/new`}
            className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white hover:opacity-90"
          >
            ＋ 新規プロジェクト
          </Link>
        </div>

        {/* タブ切替 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <TabPill
            label="📂 プロジェクト一覧"
            count={projects.length}
            active={tab === "list"}
            onClick={() => switchTab("list")}
          />
          <TabPill
            label="🏆 ランキング"
            count={active.length}
            active={tab === "ranking"}
            onClick={() => switchTab("ranking")}
          />
          <TabPill
            label="📰 タイムライン"
            count={timelinePosts.length}
            active={tab === "timeline"}
            onClick={() => switchTab("timeline")}
          />
        </div>

        {tab === "list" && (
          <ProjectList orgSlug={orgSlug} active={active} others={others} />
        )}

        {tab === "ranking" && (
          <ProjectRanking orgSlug={orgSlug} active={active} />
        )}

        {tab === "timeline" && (
          <TimelineFeed
            orgSlug={orgSlug}
            currentUserId={currentUserId}
            posts={timelinePosts}
            authorsById={authorsById}
            composeProjects={composeProjects}
            crossProject
            onChanged={() => router.refresh()}
          />
        )}
      </div>

      {/* 右カラム */}
      <aside className="flex flex-col gap-4 lg:gap-5">
        <GlassCard className="p-5">
          <h3 className="t-h3 mb-3">
            <span aria-hidden className="mr-2">
              📋
            </span>
            テーマ出題のポイント
          </h3>
          <ul className="space-y-2 text-[12px] text-mute leading-relaxed">
            <li>① 地域のためのテーマであること</li>
            <li>② 既存サービスは「手段」であって「目的」ではない</li>
            <li>③ 若者が "当事者" として関われる余地があること</li>
          </ul>
        </GlassCard>
        <GlassCard variant="dark" className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-bold">
              {currentQuest?.emoji ?? "🎯"}{" "}
              {currentQuest?.title ?? "今週のクエスト"}
            </h3>
            <span className="t-label opacity-70">
              {currentQuest ? `残り ${daysLeft}日` : "未設定"}
            </span>
          </div>
          {questItems.length === 0 ? (
            <p className="text-[12px] opacity-80 leading-relaxed">
              管理者ダッシュボードでクエストを設定してください。
              <Link
                href={`/${orgSlug}/admin`}
                className="ml-1 underline opacity-80 hover:opacity-100"
              >
                → /admin
              </Link>
            </p>
          ) : (
            <div className="space-y-2.5 text-[12px] opacity-90">
              {questItems.map((it) => {
                const done = it.done_count >= it.target_count;
                return (
                  <div key={it.id} className="flex items-center gap-2">
                    <span aria-hidden>{done ? "●" : "○"}</span>
                    <span className={done ? "line-through opacity-60" : ""}>
                      {it.label}
                    </span>
                    {it.target_count > 1 && (
                      <span className="t-label opacity-70 ml-auto">
                        {it.done_count}/{it.target_count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </aside>
    </div>
  );
}

function TabPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
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
    </button>
  );
}

function ProjectList({
  orgSlug,
  active,
  others,
}: {
  orgSlug: string;
  active: Project[];
  others: Project[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="t-label mb-2">進行中のプロジェクト ({active.length})</h3>
        {active.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <div className="text-4xl mb-3">🌱</div>
            <h3 className="t-h3 mb-1">最初のプロジェクトを始めましょう</h3>
            <p className="t-cap mb-5">
              テーマに応募して、若者主導でプロジェクトを立ち上げます。
            </p>
            <Link
              href={`/${orgSlug}/projects/new`}
              className="inline-block rounded-full bg-ink px-5 py-2 text-[12px] font-semibold text-white"
            >
              プロジェクトを作成
            </Link>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {active.map((p) => (
              <ProjectCard key={p.id} orgSlug={orgSlug} project={p} />
            ))}
          </div>
        )}
      </section>
      {others.length > 0 && (
        <section>
          <h3 className="t-label mb-2">
            プロジェクトライブラリ ({others.length})
          </h3>
          <GlassCard className="p-3">
            <ul className="divide-y divide-line-soft">
              {others.map((p) => {
                const accessible = p.access !== "none";
                return (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <StatusDot status={p.status} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium truncate flex items-center gap-1.5">
                        {p.name}
                        {!accessible && (
                          <span
                            className="t-cap"
                            aria-hidden
                            title="アクセス権限がありません"
                          >
                            🔒
                          </span>
                        )}
                      </div>
                      <div className="t-cap truncate">{p.idea_title ?? ""}</div>
                    </div>
                    <span className="t-label">{p.status}</span>
                  </li>
                );
              })}
            </ul>
          </GlassCard>
        </section>
      )}
    </div>
  );
}

function ProjectRanking({
  orgSlug,
  active,
}: {
  orgSlug: string;
  active: Project[];
}) {
  const sorted = [...active].sort(
    (a, b) => b.progress_pct - a.progress_pct,
  );
  if (sorted.length === 0) {
    return (
      <GlassCard className="p-8 text-center">
        <div className="text-4xl mb-3">🌱</div>
        <h3 className="t-h3 mb-1">進行中のプロジェクトがまだありません</h3>
      </GlassCard>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {sorted.map((p, i) => {
        const accessible = p.access !== "none";
        const inner = (
          <div className="flex items-center gap-4">
            <RingV2 size={56} value={p.progress_pct} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                {i < 3 && (
                  <span className="t-label" aria-hidden>
                    {["🥇", "🥈", "🥉"][i]}
                  </span>
                )}
                <h3 className="text-[13px] font-bold truncate">
                  {p.team_name ?? p.name}
                </h3>
                {!accessible && (
                  <span
                    className="t-cap inline-flex items-center gap-0.5 rounded-full bg-mute/10 px-1.5 py-0.5"
                    title="アクセス権限がありません"
                  >
                    🔒
                  </span>
                )}
              </div>
              <p className="t-cap truncate mb-1">{p.idea_title ?? p.name}</p>
              <div className="flex items-center gap-3 text-[10px] text-mute">
                {p.streak_days > 0 && <span>🔥 {p.streak_days}日連続</span>}
                <span>進捗 {p.progress_pct}%</span>
              </div>
            </div>
          </div>
        );
        return accessible ? (
          <Link
            key={p.id}
            href={`/${orgSlug}/dashboard?p=${p.id}`}
            className="block"
          >
            <GlassCard className="p-4 lift cursor-pointer">{inner}</GlassCard>
          </Link>
        ) : (
          <GlassCard
            key={p.id}
            className="p-4 opacity-70 cursor-not-allowed"
            title="アクセス権限がありません"
          >
            {inner}
          </GlassCard>
        );
      })}
    </div>
  );
}

function ProjectCard({
  orgSlug,
  project: p,
}: {
  orgSlug: string;
  project: Project;
}) {
  const accessible = p.access !== "none";
  const inner = (
    <div className="flex items-center gap-3">
      <RingV2 size={48} value={p.progress_pct} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="text-[13px] font-bold truncate">
            {p.team_name ?? p.name}
          </h3>
          {!accessible && (
            <span className="t-cap inline-flex items-center gap-0.5 rounded-full bg-mute/10 px-1.5 py-0.5">
              🔒
            </span>
          )}
        </div>
        <p className="t-cap truncate mb-1">{p.idea_title ?? p.name}</p>
        <div className="flex items-center gap-2 text-[10px] text-mute">
          <StatusDot status={p.status} />
          <span>{p.status}</span>
          {p.streak_days > 0 && <span>🔥 {p.streak_days}日</span>}
        </div>
      </div>
    </div>
  );
  return accessible ? (
    <Link href={`/${orgSlug}/dashboard?p=${p.id}`} className="block">
      <GlassCard className="p-3 lift cursor-pointer">{inner}</GlassCard>
    </Link>
  ) : (
    <GlassCard
      className="p-3 opacity-70 cursor-not-allowed"
      title="アクセス権限がありません"
    >
      {inner}
    </GlassCard>
  );
}
