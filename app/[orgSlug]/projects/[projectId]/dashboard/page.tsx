import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { listOrgProjects } from "@/lib/projects";
import { getProjectViewableOrNotFound } from "@/lib/getProject";
import { GlassCard } from "@/components/ui/GlassCard";
import { MilestoneBar } from "@/components/ui/MilestoneBar";
import { ConfettiBurst } from "@/components/ui/ConfettiBurst";
import { StatusDot } from "@/components/ui/StatusDot";
import { DashboardTimeline } from "@/components/dashboard/DashboardTimeline";
import { ThumbnailEditor } from "@/components/dashboard/ThumbnailEditor";
import { BadgeMedal } from "@/components/dashboard/BadgeMedal";
import { AIScoreCard } from "@/components/projects/AIScoreCard";
import { BADGES } from "@/lib/badges";
import { computeProjectScore } from "@/lib/projectScore";

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

const STATUS_LABEL: Record<string, string> = {
  active: "進行中",
  paused: "休止",
  completed: "完了",
  archived: "アーカイブ",
};

const STATUS_BG: Record<string, string> = {
  active: "var(--ok)",
  paused: "var(--warn)",
  completed: "var(--c-accent)",
  archived: "var(--mute)",
};

const TASK_STATUS_COLOR: Record<string, string> = {
  done: "var(--ok)",
  review: "var(--warn)",
  doing: "var(--c-accent)",
  todo: "var(--mute)",
};

const TAG_BG: Record<string, string> = {
  現場: "rgba(91,141,239,.18)",
  資料: "rgba(150,170,200,.22)",
  申請: "rgba(255,209,102,.28)",
  広報: "rgba(239,71,111,.18)",
  連携: "rgba(10,135,84,.18)",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const supabase = await createClient();
  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) {
    return <div className="p-8 text-error">組織が見つかりません</div>;
  }

  const projects = await listOrgProjects(supabase, org.id);
  // ダッシュは未参加の組織メンバーも閲覧可 (読み取り専用)
  const current = await getProjectViewableOrNotFound(supabase, org.id, projectId);

  // 編集権限: 「manage」アクセスを持つ場合のみ (= org admin/owner or project lead)
  const currentAccess = projects.find((pr) => pr.id === current.id)?.access;
  const canEditProject = currentAccess === "manage";
  // 参加者 (lead/member) or 組織admin か。未参加メンバーは閲覧専用。
  const isParticipant = currentAccess === "manage" || currentAccess === "view";

  const [{ data: milestones }, { data: tasks }, { data: events }, { data: pms }] =
    await Promise.all([
      supabase
        .from("milestones")
        .select("*")
        .eq("project_id", current.id)
        .order("date", { ascending: true }),
      supabase
        .from("tasks")
        .select("*")
        .eq("project_id", current.id)
        .order("updated_at", { ascending: false })
        .limit(60),
      supabase
        .from("events")
        .select("*")
        .eq("project_id", current.id)
        .order("date", { ascending: true })
        .limit(5),
      supabase
        .from("project_memberships")
        .select("user_id, role, title, responsibility, work_description")
        .eq("project_id", current.id)
        .order("role", { ascending: true }),
    ]);

  // ── AI評価/KPI の「数値だけ」を取得 ──────────────────
  // 実行計画の本文・KPI 内訳・ふりかえり内容は漏らさず、ダッシュに出すスコア算出に
  // 必要な数値だけを SECURITY DEFINER 関数経由で取る (未参加メンバーでも閲覧可)。
  const { data: scoreInputsRaw } = await supabase.rpc(
    "project_dashboard_score_inputs",
    { p_project_id: current.id },
  );
  const scoreInputs = (scoreInputsRaw ?? {}) as {
    scores?: Record<string, number>;
    kpi_progress?: number[];
    retro_user_ids?: string[];
  };

  const { loadTimeline } = await import("@/lib/timeline");
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  const timeline = await loadTimeline(supabase, [current.id], 30);

  // 別クエリで profiles を取って手で join (PostgREST embed の関係推論で空配列に
  // なるケースを回避)
  const pmUserIds = (pms ?? []).map((m) => m.user_id);
  const { data: pmProfiles } =
    pmUserIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", pmUserIds)
      : { data: [] as { id: string; display_name: string | null; avatar_url: string | null }[] };
  const pmProfileById = new Map((pmProfiles ?? []).map((p) => [p.id, p]));

  const projectMembers = (pms ?? []).map((m) => {
    const p = pmProfileById.get(m.user_id);
    return {
      user_id: m.user_id,
      role: m.role as "lead" | "member",
      title: m.title,
      responsibility: m.responsibility,
      work_description: m.work_description,
      display_name: p?.display_name ?? null,
      avatar_url: p?.avatar_url ?? null,
    };
  });

  const allTasks = tasks ?? [];
  const doneCount = allTasks.filter((t) => t.status === "done").length;
  const taskDonePct =
    allTasks.length > 0 ? Math.round((doneCount / allTasks.length) * 100) : 0;
  const doingTasks = allTasks
    .filter((t) => t.status === "doing" || t.status === "review")
    .slice(0, 6);

  const scores = scoreInputs.scores ?? {};
  const planAvg =
    [scores.why, scores.who, scores.what, scores.how]
      .filter((v): v is number => typeof v === "number")
      .reduce((a, b, _, arr) => a + b / arr.length, 0) || 0;

  // ── AI 総合評価 (5 次元) ──────────────────────────
  const planScores =
    scoreInputs.scores && Object.keys(scoreInputs.scores).length > 0
      ? scoreInputs.scores
      : null;
  const milestonesTotal = (milestones ?? []).length;
  const milestonesDone = (milestones ?? []).filter((m) => m.done).length;
  const retroSubmittedUserIds = new Set(scoreInputs.retro_user_ids ?? []);
  const retroSubmittedUserCount = projectMembers.filter((m) =>
    retroSubmittedUserIds.has(m.user_id),
  ).length;
  // KPI progress (実行計画 → kpis): スコア算出用の進捗率のみ (詳細は非公開)
  const kpiProgressList: number[] = (scoreInputs.kpi_progress ?? []).map((v) =>
    typeof v === "number" ? v : 0,
  );
  const projectScore = computeProjectScore({
    planScores,
    members: projectMembers.map((m) => ({
      role: m.role,
      title: m.title,
      responsibility: m.responsibility,
      work_description: m.work_description,
    })),
    taskTotal: allTasks.length,
    taskDone: doneCount,
    milestoneTotal: milestonesTotal,
    milestoneDone: milestonesDone,
    streakDays: current.streak_days,
    retroSubmittedUserCount,
    memberCount: projectMembers.length,
    kpiProgressList,
  });

  const dueIn =
    current.due_at !== null
      ? daysBetween(new Date(), new Date(current.due_at))
      : null;
  const totalDays =
    current.started_at && current.due_at
      ? daysBetween(
          new Date(current.started_at),
          new Date(current.due_at),
        )
      : null;
  const elapsedDays =
    current.started_at
      ? daysBetween(new Date(current.started_at), new Date())
      : null;
  const periodPct =
    totalDays && totalDays > 0 && elapsedDays !== null
      ? Math.max(0, Math.min(100, Math.round((elapsedDays / totalDays) * 100)))
      : null;

  const milestoneItems = (milestones ?? []).map((m) => ({
    id: m.id,
    label: m.label,
    date: m.date,
    done: m.done,
  }));

  const completedMilestones = milestoneItems.filter((m) => m.done).length;

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <ConfettiBurst />

      {!isParticipant && (
        <div
          className="rounded-xl p-3 text-[12.5px] leading-relaxed"
          style={{
            background: "rgba(91,141,239,.10)",
            borderLeft: "4px solid var(--c-accent)",
          }}
        >
          👀 <strong>閲覧専用</strong>
          ・このプロジェクトには参加していません。ダッシュボードの概要は見られますが、
          各タブの編集やタイムラインへの投稿はできません。
        </div>
      )}

      {/* ── HERO: サムネ + プロジェクト情報 + 残り/連続/期間消化 ── */}
      <GlassCard className="p-4 md:p-5 overflow-hidden">
        <div className="flex flex-col md:flex-row gap-4 md:gap-5">
          {/* サムネ (canEdit ならクリックで編集モーダル) */}
          <div className="w-full md:w-[260px] flex-shrink-0">
            <ThumbnailEditor
              projectId={current.id}
              currentUrl={current.thumbnail_url}
              canEdit={canEditProject}
            >
              <div
                className="relative w-full rounded-2xl overflow-hidden"
                style={{
                  aspectRatio: "4 / 3",
                  background: current.thumbnail_url
                    ? `url(${current.thumbnail_url}) center / cover`
                    : "linear-gradient(135deg, var(--c-accent-soft), var(--c-accent-bright))",
                }}
              >
                {!current.thumbnail_url && (
                  <div className="absolute inset-0 grid place-items-center text-5xl text-white/90">
                    🚀
                  </div>
                )}
                {current.is_demo && (
                  <span className="absolute top-2 left-2 rounded-full bg-warn px-2 py-0.5 text-[10px] font-bold text-white">
                    📌 見本
                  </span>
                )}
              </div>
            </ThumbnailEditor>
          </div>

          {/* 情報 */}
          <div className="flex-1 flex flex-col justify-between min-w-0">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {current.idea_title && (
                  <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[10.5px] font-semibold text-[--c-accent-deep]">
                    {current.idea_title}
                  </span>
                )}
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold text-white"
                  style={{ background: STATUS_BG[current.status] }}
                >
                  {STATUS_LABEL[current.status] ?? current.status}
                </span>
              </div>
              <h1 className="text-[22px] md:text-[26px] font-extrabold tracking-tight leading-tight mb-2">
                {current.name}
              </h1>
              <p className="text-[12.5px] leading-relaxed text-mute max-w-[620px] line-clamp-2">
                {current.team_name && `チーム ${current.team_name}`}
                {current.team_name && current.idea_title && " ・ "}
                {current.idea_title ?? "アイデア未設定"}
              </p>
            </div>
            <div className="flex items-center gap-4 mt-4 flex-wrap">
              {dueIn !== null && (
                <div className="flex flex-col">
                  <span className="t-label">残り日数</span>
                  <span className="t-mono text-[20px] font-extrabold leading-none mt-0.5">
                    {Math.max(0, dueIn)}
                    <span className="text-[12px] text-mute ml-1 font-medium">日</span>
                  </span>
                </div>
              )}
              <span className="hidden sm:block w-px h-9 bg-line" />
              <div className="flex flex-col">
                <span className="t-label">連続稼働</span>
                <span
                  className="text-[20px] font-extrabold leading-none mt-0.5"
                  style={{ color: "#b45309" }}
                >
                  🔥 {current.streak_days}
                  <span className="text-[12px] text-mute ml-1 font-medium">日</span>
                </span>
              </div>
              {periodPct !== null && (
                <>
                  <span className="hidden sm:block w-px h-9 bg-line" />
                  <div className="flex flex-col flex-1 min-w-[180px] max-w-[240px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="t-label">期間消化</span>
                      <span className="t-mono text-[10px] text-mute">
                        {periodPct}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-line-soft overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${periodPct}%`,
                          background:
                            periodPct > current.progress_pct + 15
                              ? "var(--warn)"
                              : "linear-gradient(90deg, var(--c-accent), var(--c-accent-deep))",
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 右カラム: AI 総合評価 + メンバーアイコン → チーム管理 */}
          <Link
            href={`/${orgSlug}/projects/${current.id}/diag`}
            className="w-full max-w-[280px] mx-auto md:mx-0 md:max-w-none md:w-[180px] flex-shrink-0 flex flex-col items-center gap-3 rounded-xl border border-line-soft bg-white/70 hover:bg-white p-3 transition group"
            title="チーム管理ページへ"
          >
            <AIScoreCard score={projectScore} compact />
            <div className="w-full pt-2 border-t border-line-soft">
              <div className="t-cap text-center mb-1.5">
                👥 チーム ({projectMembers.length})
              </div>
              {projectMembers.length > 0 ? (
                <div className="flex justify-center -space-x-1.5 flex-wrap">
                  {projectMembers.slice(0, 6).map((m) => (
                    <span
                      key={m.user_id}
                      className="grid h-7 w-7 place-items-center rounded-full text-white text-[11px] font-bold ring-2 ring-white"
                      style={{
                        background: m.avatar_url
                          ? `url(${m.avatar_url}) center / cover`
                          : "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
                      }}
                      title={m.display_name ?? undefined}
                    >
                      {!m.avatar_url &&
                        ((m.display_name ?? "?")[0] ?? "?")}
                    </span>
                  ))}
                  {projectMembers.length > 6 && (
                    <span
                      className="grid h-7 w-7 place-items-center rounded-full bg-canvas-2 text-[10px] font-bold text-mute ring-2 ring-white"
                      aria-hidden
                    >
                      +{projectMembers.length - 6}
                    </span>
                  )}
                </div>
              ) : (
                <p className="t-cap text-center opacity-70">
                  メンバー未登録
                </p>
              )}
            </div>
            <span className="t-cap font-semibold text-[--c-accent-deep] group-hover:underline">
              チーム管理 →
            </span>
          </Link>
        </div>
      </GlassCard>

      {/* 見本プロジェクト注意 */}
      {current.is_demo && (
        <div
          className="rounded-xl p-3 text-[12.5px] leading-relaxed"
          style={{
            background: "rgba(255,176,32,.12)",
            borderLeft: "4px solid var(--warn)",
          }}
        >
          📌 <strong>これは見本プロジェクトです</strong>。実際のチームではなく
          UI を体験するためのサンプル。不要になったら 管理者ダッシュボード →
          プロジェクト監視 から削除できます。
        </div>
      )}

      {/* バッジコレクション + メンバー (2 列、マイルストーンと同じ 1.3fr_1fr) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4 lg:gap-5">
        <GlassCard className="p-4 min-w-0 overflow-hidden" data-c-fun="playful">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="t-h3">
              <span aria-hidden className="mr-2">
                🏅
              </span>
              バッジコレクション
            </h3>
            <Link
              href={`/${orgSlug}/projects/${current.id}/diag`}
              className="t-cap"
            >
              <span className="font-bold text-ink">
                {current.badges.filter((id) =>
                  BADGES.some((b) => b.id === id),
                ).length}
              </span>{" "}
              / {BADGES.length} 獲得 ・ 詳細 →
            </Link>
          </div>
          <div
            className="flex gap-2 overflow-x-auto pb-1 -mb-1"
            style={{ scrollbarWidth: "thin" }}
          >
            {BADGES.map((b) => {
              const earned = current.badges.includes(b.id);
              return (
                <div key={b.id} className="flex-shrink-0 w-[120px]">
                  <BadgeMedal
                    name={b.name}
                    desc={b.desc}
                    earned={earned}
                    glyph={b.glyph}
                  />
                </div>
              );
            })}
          </div>
        </GlassCard>

        {/* メンバー (バッジと同じ高さ感、丸アイコン + 氏名 + 肩書き) */}
        <GlassCard className="p-4 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="t-h3">
              <span aria-hidden className="mr-2">
                👥
              </span>
              メンバー ({projectMembers.length})
            </h3>
            <Link
              href={`/${orgSlug}/projects/${current.id}/diag`}
              className="t-cap underline"
            >
              管理 →
            </Link>
          </div>
          {projectMembers.length === 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[
                { emo: "🦁", label: "リード", bg: "#fde68a" },
                { emo: "🐻", label: "実行", bg: "#fed7aa" },
                { emo: "🦊", label: "クリエイティブ", bg: "#fecaca" },
                { emo: "🦉", label: "アドバイザー", bg: "#ddd6fe" },
              ].map((slot, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-[88px] flex flex-col items-center text-center gap-1.5 px-2 py-3 rounded-2xl border border-dashed border-line bg-white/60"
                >
                  <span
                    className="grid h-12 w-12 place-items-center rounded-full text-[24px] leading-none"
                    style={{ background: slot.bg }}
                    aria-hidden
                  >
                    {slot.emo}
                  </span>
                  <span className="text-[11px] font-semibold text-mute leading-tight">
                    {slot.label}
                  </span>
                  <span className="t-cap">未登録</span>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="flex gap-2 overflow-x-auto pb-1"
              style={{ scrollbarWidth: "thin" }}
            >
              {projectMembers.map((m) => (
                <div
                  key={m.user_id}
                  className="flex-shrink-0 w-[88px] flex flex-col items-center text-center gap-1.5 px-2 py-3 rounded-2xl border border-line-soft bg-white"
                >
                  <span
                    className="grid h-12 w-12 place-items-center rounded-full text-white text-[16px] font-bold"
                    style={{
                      background: m.avatar_url
                        ? `url(${m.avatar_url}) center / cover`
                        : m.role === "lead"
                          ? "linear-gradient(135deg, var(--ink), #1f2937)"
                          : "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
                    }}
                  >
                    {!m.avatar_url && ((m.display_name ?? "?")[0] ?? "?")}
                  </span>
                  <span
                    className="text-[11.5px] font-bold text-ink leading-tight truncate w-full"
                    title={m.display_name ?? undefined}
                  >
                    {m.display_name ?? "—"}
                  </span>
                  <span
                    className="t-cap leading-tight truncate w-full"
                    title={m.title ?? undefined}
                  >
                    {m.title ?? (m.role === "lead" ? "リード" : "メンバー")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {/* 2-col: main / timeline */}
      {current.is_demo && (
        <div
          className="rounded-xl p-3 text-[12.5px] leading-relaxed"
          style={{
            background: "rgba(255,176,32,.12)",
            borderLeft: "4px solid var(--warn)",
          }}
        >
          📌 <strong>これは見本プロジェクトです</strong>。実際のチームではなく
          UI を体験するためのサンプル。不要になったら 管理者ダッシュボード →
          プロジェクト監視 から削除できます。
        </div>
      )}

      <div
        className={
          isParticipant
            ? "grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4 lg:gap-5"
            : "flex flex-col gap-4 lg:gap-5"
        }
      >
        {/* メイン (左) */}
        <div className="flex flex-col gap-4 lg:gap-5 min-w-0">
          {/* マイルストーン */}
          <GlassCard className="p-5">
            <div className="flex items-end justify-between mb-2">
              <h3 className="t-h3">
                <span aria-hidden className="mr-2">
                  📍
                </span>
                マイルストーン
              </h3>
              <Link
                href={`/${orgSlug}/projects/${current.id}/wbs`}
                className="t-cap underline"
              >
                WBS で編集 →
              </Link>
            </div>
            <MilestoneBar items={milestoneItems} />
          </GlassCard>

          {/* 進行中タスク */}
          <GlassCard className="p-5">
            <div className="flex items-end justify-between mb-3">
              <h3 className="t-h3">
                <span aria-hidden className="mr-2">
                  ⚙️
                </span>
                進行中タスク
              </h3>
              <Link
                href={`/${orgSlug}/projects/${current.id}/wbs`}
                className="t-cap underline"
              >
                全て見る →
              </Link>
            </div>
            {doingTasks.length === 0 ? (
              <p className="t-cap text-center py-6">
                進行中のタスクはありません。WBS から新しいタスクを追加してください。
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {doingTasks.map((t) => (
                  <li
                    key={t.id}
                    className="grid grid-cols-[16px_1fr_auto_auto_auto] items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent-soft/40"
                  >
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{
                        background:
                          TASK_STATUS_COLOR[t.status] ?? "var(--mute)",
                      }}
                      aria-label={t.status}
                    />
                    <span className="text-[12.5px] font-medium truncate">
                      {t.title}
                    </span>
                    <span className="t-cap truncate max-w-[72px]">
                      {t.owner_name ?? "-"}
                    </span>
                    <span className="t-mono whitespace-nowrap">
                      {t.progress}%
                    </span>
                    {t.tag ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          background:
                            TAG_BG[t.tag] ?? "rgba(150,170,200,.22)",
                        }}
                      >
                        {t.tag}
                      </span>
                    ) : (
                      <span />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>

          {/* 直近予定 */}
          <GlassCard variant="dark" className="p-4">
            <h3 className="text-[13px] font-bold mb-2.5">
              <span aria-hidden className="mr-2">
                📅
              </span>
              直近の予定
            </h3>
            {(events ?? []).length === 0 ? (
              <p className="text-[11.5px] opacity-80">
                予定は登録されていません。
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {(events ?? []).map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center gap-2 text-[12px]"
                  >
                    <span className="t-mono w-12 opacity-80">
                      {e.date
                        ? e.date.slice(5).replace("-", "/")
                        : "--/--"}
                    </span>
                    <span className="flex-1 truncate">{e.label}</span>
                    {e.kind && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold">
                        {e.kind}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </div>

        {/* 右カラム: タイムライン (sticky scroll) — 参加者のみ */}
        {isParticipant && (
        <aside className="lg:sticky lg:top-[90px] lg:self-start lg:max-h-[calc(100vh-200px)] flex flex-col min-w-0">
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
              <span className="t-cap">{timeline.posts.length} 件</span>
            </div>
            <div
              className="flex-1 overflow-y-auto -mr-2 pr-2"
              style={{ minHeight: 0 }}
            >
              <DashboardTimeline
                orgSlug={orgSlug}
                currentUserId={currentUser?.id ?? null}
                posts={timeline.posts}
                authorsTuples={Array.from(timeline.authorsById.entries())}
                project={{
                  id: current.id,
                  name: current.name,
                  team_name: current.team_name,
                }}
              />
            </div>
          </GlassCard>
        </aside>
        )}
      </div>
    </div>
  );
}

function Stat({
  emo,
  label,
  value,
}: {
  emo: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-white border border-line-soft px-2.5 py-2">
      <div className="flex items-center gap-1 mb-0.5">
        <span aria-hidden>{emo}</span>
        <span className="t-label">{label}</span>
      </div>
      <div className="text-[12.5px] font-semibold truncate">{value}</div>
    </div>
  );
}

function InlineStat({
  emo,
  label,
  value,
}: {
  emo: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span aria-hidden>{emo}</span>
      <span className="t-label whitespace-nowrap">{label}</span>
      <span className="font-semibold truncate">{value}</span>
    </div>
  );
}
