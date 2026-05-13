import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { pickCurrentProject, listOrgProjects } from "@/lib/projects";
import { GlassCard } from "@/components/ui/GlassCard";
import { MetricRing } from "@/components/ui/MetricRing";
import { MilestoneBar } from "@/components/ui/MilestoneBar";
import { ConfettiBurst } from "@/components/ui/ConfettiBurst";
import { StatusDot } from "@/components/ui/StatusDot";
import { ProjectPicker } from "@/components/projects/ProjectPicker";

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

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

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { orgSlug } = await params;
  const { p } = await searchParams;
  const supabase = await createClient();
  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) {
    return <div className="p-8 text-error">組織が見つかりません</div>;
  }

  const projects = await listOrgProjects(supabase, org.id);
  const current = await pickCurrentProject(supabase, org.id, p);

  if (!current) {
    return (
      <div className="max-w-xl mx-auto">
        <GlassCard className="p-10 text-center">
          <div className="text-5xl mb-4">🌱</div>
          <h2 className="t-h2 mb-1">プロジェクトがまだありません</h2>
          <p className="t-cap mb-6">
            最初の挑戦を立ち上げて、伴走を始めましょう。
          </p>
          <Link
            href={`/${orgSlug}/projects/new`}
            className="inline-block rounded-full bg-ink px-6 py-3 text-[13px] font-semibold text-white"
          >
            ＋ 新規プロジェクトを作成
          </Link>
        </GlassCard>
      </div>
    );
  }

  // ── 関連データを並行取得 ──
  const [{ data: milestones }, { data: tasks }, { data: events }, { data: plan }] =
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
        .from("execution_plans")
        .select("scores")
        .eq("project_id", current.id)
        .maybeSingle(),
    ]);

  const allTasks = tasks ?? [];
  const doneCount = allTasks.filter((t) => t.status === "done").length;
  const taskDonePct =
    allTasks.length > 0 ? Math.round((doneCount / allTasks.length) * 100) : 0;
  const doingTasks = allTasks
    .filter((t) => t.status === "doing" || t.status === "review")
    .slice(0, 6);

  const scores = (plan?.scores ?? {}) as Record<string, number>;
  const planAvg =
    [scores.why, scores.who, scores.what, scores.how]
      .filter((v): v is number => typeof v === "number")
      .reduce((a, b, _, arr) => a + b / arr.length, 0) || 0;

  const dueIn =
    current.due_at !== null
      ? daysBetween(new Date(), new Date(current.due_at))
      : null;

  const milestoneItems = (milestones ?? []).map((m) => ({
    id: m.id,
    label: m.label,
    date: m.date,
    done: m.done,
  }));

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <ConfettiBurst />

      {/* Header ─────────────────────────────────────────── */}
      <GlassCard className="p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="grid h-12 w-12 place-items-center rounded-2xl text-white text-xl"
            style={{
              background:
                "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
            }}
          >
            🚀
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-[18px] font-extrabold tracking-tight truncate">
                {current.name}
              </h1>
              <StatusDot status={current.status} />
            </div>
            <div className="t-cap truncate">
              {[current.team_name, current.idea_title].filter(Boolean).join(" ・ ") ||
                " "}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dueIn !== null && dueIn >= 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold text-[--c-accent-deep]">
              📅 残り {dueIn}日
            </span>
          )}
          {current.streak_days > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-ink shadow-[0_1px_0_var(--line-soft)]"
              data-c-fun="playful"
            >
              🔥 {current.streak_days}日連続
            </span>
          )}
          <Link
            href={`/${orgSlug}/projects/${current.id}/members`}
            className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-semibold text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)]"
            title="プロジェクトメンバーを管理"
          >
            👥 メンバー
          </Link>
          <ProjectPicker
            orgSlug={orgSlug}
            projects={projects}
            currentId={current.id}
          />
        </div>
      </GlassCard>

      {/* 4 metric rings ────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricRing
          value={current.progress_pct}
          label="全体進捗"
          sub={`${current.progress_pct}%`}
          chip={current.progress_pct >= 50 ? "✦ 折り返し" : undefined}
        />
        <MetricRing
          value={taskDonePct}
          label="タスク完了率"
          sub={`${doneCount} / ${allTasks.length}`}
        />
        <MetricRing
          value={Math.min(100, current.streak_days * 5)}
          label="連続日数"
          sub={`${current.streak_days}日`}
          color="var(--warn)"
          fun
        />
        <MetricRing
          value={Math.round(planAvg)}
          label="計画スコア"
          sub={planAvg > 0 ? `${Math.round(planAvg)}` : "未評価"}
          chip={planAvg >= 75 ? "強い計画" : undefined}
        />
      </div>

      {/* Body: milestones + tasks (left) / badges + events (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4 lg:gap-5">
        <div className="flex flex-col gap-4 lg:gap-5">
          <GlassCard className="p-5">
            <div className="flex items-end justify-between mb-2">
              <h3 className="t-h3">
                <span aria-hidden className="mr-2">
                  📍
                </span>
                マイルストーン
              </h3>
              <Link
                href={`/${orgSlug}/wbs`}
                className="t-cap underline"
              >
                WBS で編集 →
              </Link>
            </div>
            <MilestoneBar items={milestoneItems} />
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-end justify-between mb-3">
              <h3 className="t-h3">
                <span aria-hidden className="mr-2">
                  ⚙️
                </span>
                進行中タスク
              </h3>
              <Link
                href={`/${orgSlug}/wbs`}
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
                        background: TASK_STATUS_COLOR[t.status] ?? "var(--mute)",
                      }}
                      aria-label={t.status}
                    />
                    <span className="text-[12.5px] font-medium truncate">
                      {t.title}
                    </span>
                    <span className="t-cap whitespace-nowrap">
                      {t.owner_name ?? "-"}
                    </span>
                    <span className="t-mono whitespace-nowrap">
                      {t.progress}%
                    </span>
                    {t.tag ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          background: TAG_BG[t.tag] ?? "rgba(150,170,200,.22)",
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
        </div>

        <div className="flex flex-col gap-4 lg:gap-5">
          <GlassCard
            className="p-5"
            data-c-fun="playful"
          >
            <h3 className="t-h3 mb-3">
              <span aria-hidden className="mr-2">
                🏅
              </span>
              バッジコレクション
            </h3>
            {current.badges.length === 0 ? (
              <p className="t-cap">
                条件を満たすとバッジが解放されます。最初の達成を待ちましょう。
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {current.badges.map((b) => (
                  <span
                    key={b}
                    className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold text-[--c-accent-deep]"
                  >
                    ✦ {b}
                  </span>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard variant="dark" className="p-5">
            <h3 className="text-[13px] font-bold mb-3">
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
              <ul className="flex flex-col gap-2">
                {(events ?? []).map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center gap-2 text-[12px]"
                  >
                    <span className="t-mono w-12 opacity-80">
                      {e.date ? e.date.slice(5).replace("-", "/") : "--/--"}
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
      </div>
    </div>
  );
}
