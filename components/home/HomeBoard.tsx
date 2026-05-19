"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo } from "react";

import { GlassCard } from "@/components/ui/GlassCard";
import { RingV2 } from "@/components/ui/RingV2";
import { StatusDot } from "@/components/ui/StatusDot";
import type {
  PostAuthor,
  ProjectLite,
  TimelinePost,
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
  initialTab?: "list" | "ranking" | "timeline";
  projects: Project[];
  currentQuest: Quest | null;
  questItems: QuestItem[];
  daysLeft: number;
  timelinePosts: TimelinePost[];
  timelineAuthors: [string, PostAuthor][];
  composeProjects: ProjectLite[];
  /** プロジェクト毎の AI 総合評価 (0-100). ランキングの数値に使用 */
  aiScoreById?: Record<string, number>;
}

export function HomeBoard({
  orgSlug,
  orgName,
  currentUserId,
  projects,
  currentQuest,
  questItems,
  daysLeft,
  timelinePosts,
  timelineAuthors,
  aiScoreById = {},
}: Props) {
  const authorsById = useMemo(() => new Map(timelineAuthors), [timelineAuthors]);

  const aiScore = (id: string) => aiScoreById[id] ?? 0;
  const active = projects.filter((p) => p.status === "active");
  const others = projects.filter((p) => p.status !== "active");
  const rankingActive = [...active].sort(
    (a, b) => aiScore(b.id) - aiScore(a.id),
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(260px,360px)] gap-4 lg:gap-5">
      {/* メイン (3/4) */}
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

        <section>
          <h3 className="t-h3 mb-3">
            <span aria-hidden className="mr-2">
              📂
            </span>
            プロジェクト一覧
          </h3>
          <ProjectList orgSlug={orgSlug} active={active} others={others} />
        </section>

        <section>
          <h3 className="t-h3 mb-3">
            <span aria-hidden className="mr-2">
              🏆
            </span>
            プロジェクトランキング
          </h3>
          <ProjectRanking
            orgSlug={orgSlug}
            active={rankingActive}
            aiScoreById={aiScoreById}
          />
        </section>
      </div>

      {/* タイムライン + クエスト (1/4) */}
      <aside className="flex flex-col gap-4 lg:gap-5 lg:sticky lg:top-[90px] lg:self-start lg:max-h-[calc(100vh-200px)]">
        <GlassCard
          variant="dark"
          className="p-5"
        >
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
            </p>
          ) : (
            <div className="space-y-2.5 text-[12px] opacity-90">
              {questItems.map((it) => {
                const done = it.done_count >= it.target_count;
                return (
                  <div key={it.id} className="flex items-center gap-2">
                    <span aria-hidden>{done ? "●" : "○"}</span>
                    <span
                      className={done ? "line-through opacity-60" : ""}
                    >
                      {it.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>

        <GlassCard
          className="p-4 flex flex-col"
          style={{ maxHeight: "calc(100vh - 200px)", overflow: "hidden" }}
        >
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <h3 className="t-h3">
              <span aria-hidden className="mr-2">
                📰
              </span>
              タイムライン
            </h3>
            <span className="t-cap">{timelinePosts.length} 件</span>
          </div>
          <p className="t-cap mb-3 leading-relaxed flex-shrink-0">
            全プロジェクトの活動が時系列で流れます。投稿はプロジェクトのダッシュボードから。
          </p>
          <div
            className="flex flex-col gap-2 overflow-y-auto -mr-2 pr-2 flex-1"
            style={{ minHeight: 0 }}
          >
            {timelinePosts.length === 0 ? (
              <div className="t-cap text-center py-6">
                まだ投稿がありません
              </div>
            ) : (
              timelinePosts.map((tp) => (
                <CompactPostCard
                  key={tp.post.id}
                  tp={tp}
                  currentUserId={currentUserId}
                  orgSlug={orgSlug}
                  authorsById={authorsById}
                />
              ))
            )}
          </div>
        </GlassCard>
      </aside>
    </div>
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
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="t-label">進行中 ({active.length})</div>
          {active.length > 4 && (
            <div className="t-cap opacity-70">← 横スクロール →</div>
          )}
        </div>
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
          <div
            className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1"
            style={{
              scrollSnapType: "x mandatory",
              scrollbarWidth: "thin",
            }}
          >
            {active.map((p) => (
              <ProjectCard key={p.id} orgSlug={orgSlug} project={p} />
            ))}
          </div>
        )}
      </div>
      {others.length > 0 && (
        <div>
          <div className="t-label mb-2">
            プロジェクトライブラリ ({others.length})
          </div>
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
        </div>
      )}
    </div>
  );
}

function ProjectRanking({
  orgSlug,
  active,
  aiScoreById,
}: {
  orgSlug: string;
  active: Project[];
  aiScoreById: Record<string, number>;
}) {
  if (active.length === 0) {
    return (
      <GlassCard className="p-6 text-center">
        <p className="t-cap">進行中のプロジェクトがまだありません</p>
      </GlassCard>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {active.map((p, i) => {
        const accessible = p.access !== "none";
        const aiScore = aiScoreById[p.id] ?? 0;
        const inner = (
          <div className="flex items-center gap-4">
            <RingV2 size={56} value={aiScore} />
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
                <span>✦ AI {aiScore}</span>
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

  // 4 列横並びを想定したカード幅。
  // 親コンテナ width に対して 1/4 を期待しつつ、4 件以上はスクロール。
  const cardStyle: React.CSSProperties = {
    flex: "0 0 calc((100% - 36px) / 4)",
    minWidth: 200,
    scrollSnapAlign: "start",
  };

  const thumb = (
    <div
      className="relative w-full aspect-[16/10] rounded-t-[12px] overflow-hidden"
      style={
        p.thumbnail_url
          ? {
              backgroundImage: `url(${p.thumbnail_url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : {
              background:
                "linear-gradient(135deg, var(--c-accent-soft), var(--c-accent-bright))",
            }
      }
      aria-hidden
    >
      {!p.thumbnail_url && (
        <div className="absolute inset-0 grid place-items-center text-4xl text-white/90">
          🚀
        </div>
      )}
      {p.is_demo && (
        <span className="absolute top-2 left-2 rounded-full bg-warn px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
          📌 見本
        </span>
      )}
    </div>
  );

  const body = (
    <div className="p-3 flex flex-col gap-1.5 flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <RingV2 size={32} value={p.progress_pct} />
        <h3 className="text-[13px] font-bold truncate flex-1">
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
      <p className="t-cap truncate min-w-0">{p.idea_title ?? p.name}</p>
      <div className="flex items-center gap-2 text-[10px] text-mute mt-auto">
        <StatusDot status={p.status} />
        <span>{p.status}</span>
        {p.streak_days > 0 && <span>🔥 {p.streak_days}日</span>}
      </div>
    </div>
  );

  const inner = (
    <div className="flex flex-col h-full">
      {thumb}
      {body}
    </div>
  );

  return accessible ? (
    <Link
      href={`/${orgSlug}/dashboard?p=${p.id}`}
      className="block"
      style={cardStyle}
    >
      <GlassCard className="p-0 overflow-hidden h-full lift cursor-pointer">
        {inner}
      </GlassCard>
    </Link>
  ) : (
    <div style={cardStyle}>
      <GlassCard
        className="p-0 overflow-hidden h-full opacity-70 cursor-not-allowed"
        title="アクセス権限がありません"
      >
        {inner}
      </GlassCard>
    </div>
  );
}

function CompactPostCard({
  tp,
  currentUserId,
  orgSlug,
  authorsById,
}: {
  tp: TimelinePost;
  currentUserId: string | null;
  orgSlug: string;
  authorsById: Map<string, PostAuthor>;
}) {
  const liked = currentUserId
    ? tp.likes.some((l) => l.user_id === currentUserId)
    : false;
  // 横幅が狭いので最低限の情報だけ
  return (
    <div className="rounded-lg bg-white border border-line-soft p-2.5">
      <div className="flex items-start gap-2 mb-1.5">
        <span
          className="grid h-7 w-7 place-items-center rounded-full text-white text-[11px] font-semibold flex-shrink-0"
          style={{
            background:
              "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
          }}
        >
          {(tp.author?.display_name ?? "?")[0]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[11.5px] font-bold truncate">
            {tp.author?.display_name ?? "（名前未設定）"}
          </div>
          {tp.project && (
            <Link
              href={`/${orgSlug}/dashboard?p=${tp.project.id}`}
              className="t-cap text-[--c-accent-deep] hover:underline truncate inline-block max-w-full"
            >
              🚀 {tp.project.name}
            </Link>
          )}
          <div className="t-cap">{relTime(tp.post.created_at)}</div>
        </div>
      </div>
      {tp.post.content && (
        <p className="text-[12px] leading-relaxed mb-1.5 whitespace-pre-wrap break-words line-clamp-4">
          {tp.post.content}
        </p>
      )}
      {tp.post.image_url && (
        <div className="rounded-md overflow-hidden border border-line-soft mb-1.5">
          <Image
            src={tp.post.image_url}
            alt=""
            width={400}
            height={250}
            unoptimized
            className="w-full h-auto max-h-[140px] object-cover"
          />
        </div>
      )}
      <div className="flex items-center gap-3 t-cap">
        <span className={"inline-flex items-center gap-0.5 " + (liked ? "text-error" : "")}>
          <span aria-hidden>{liked ? "❤️" : "🤍"}</span>
          <span>{tp.likes.length}</span>
        </span>
        <span className="inline-flex items-center gap-0.5">
          <span aria-hidden>💬</span>
          <span>{tp.comments.length}</span>
        </span>
        {tp.project && (
          <Link
            href={`/${orgSlug}/dashboard?p=${tp.project.id}`}
            className="ml-auto underline opacity-70 hover:opacity-100"
          >
            開く →
          </Link>
        )}
      </div>
    </div>
  );
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "今";
  if (min < 60) return `${min}分前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}日前`;
  return new Date(iso).toLocaleDateString("ja-JP");
}
