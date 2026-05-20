import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { listOrgProjects } from "@/lib/projects";
import { resolveProjectOrRedirect } from "@/lib/resolveProjectOrRedirect";
import { DiagBoard } from "@/components/diag/DiagBoard";
import { TeamManagementBody } from "@/components/diag/TeamManagementBody";
import { GlassCard } from "@/components/ui/GlassCard";
import { computeProjectScore } from "@/lib/projectScore";

export const dynamic = "force-dynamic";

export default async function TeamManagementPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { orgSlug } = await params;
  const { p } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) {
    return <div className="p-8 text-error">組織が見つかりません</div>;
  }

  const projects = await listOrgProjects(supabase, org.id);
  const current = await resolveProjectOrRedirect(
    supabase,
    { id: org.id, slug: orgSlug },
    p ?? null,
    "diag",
  );

  if (!current) {
    return (
      <div className="max-w-xl mx-auto">
        <GlassCard className="p-10 text-center">
          <div className="text-5xl mb-4">🏢</div>
          <h2 className="t-h2 mb-1">チーム管理はプロジェクトが必要です</h2>
          <p className="t-cap mb-6">まず最初のプロジェクトを立ち上げましょう。</p>
          <Link
            href={`/${orgSlug}/projects/new`}
            className="inline-block rounded-full bg-ink px-6 py-3 text-[13px] font-semibold text-white"
          >
            ＋ 新規プロジェクト
          </Link>
        </GlassCard>
      </div>
    );
  }

  const { data: canManage } = await supabase.rpc("can_manage_project", {
    p_project_id: current.id,
  });

  // ── プロジェクトメンバーは migration 0025 未適用環境でも落ちないよう safe 経由
  const { fetchProjectMembersSafe } = await import(
    "@/lib/projectMembershipSafe"
  );
  const safeMembers = await fetchProjectMembersSafe(supabase, current.id);
  const projMemberships = safeMembers.members;
  const legacySchema = safeMembers.legacySchema;

  // ── 並列フェッチ ────────────────────────────────────
  const [
    { data: orgMemberships },
    { count: meetingsCount },
    { count: recurringMeetingsCount },
    { data: plan },
    { count: milestonesTotal },
    { count: milestonesDone },
    { count: tasksTotal },
    { count: tasksDone },
    { data: budgetItems },
    { data: retroSubmitters },
    { data: entries },
  ] = await Promise.all([
    supabase
      .from("memberships")
      .select("user_id, role")
      .eq("organization_id", org.id),
    supabase
      .from("meetings")
      .select("*", { count: "exact", head: true })
      .eq("project_id", current.id),
    supabase
      .from("meeting_recurrences")
      .select("*", { count: "exact", head: true })
      .eq("project_id", current.id)
      .eq("active", true),
    supabase
      .from("execution_plans")
      .select(
        "id, why, who, what, how, product, price, place, promotion, qualitative_goal, scores, last_observation",
      )
      .eq("project_id", current.id)
      .maybeSingle(),
    supabase
      .from("milestones")
      .select("*", { count: "exact", head: true })
      .eq("project_id", current.id),
    supabase
      .from("milestones")
      .select("*", { count: "exact", head: true })
      .eq("project_id", current.id)
      .eq("done", true),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("project_id", current.id),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("project_id", current.id)
      .eq("status", "done"),
    supabase
      .from("budget_items")
      .select("month")
      .eq("project_id", current.id)
      .not("month", "is", null),
    supabase
      .from("diagnosis_entries")
      .select("user_id")
      .eq("project_id", current.id)
      .not("user_id", "is", null),
    supabase
      .from("diagnosis_entries")
      .select("*")
      .eq("project_id", current.id)
      .order("entry_date", { ascending: false })
      .limit(200),
  ]);

  // ── プロフィール一括 ─────────────────────────────────
  const allUserIds = Array.from(
    new Set([
      ...(orgMemberships ?? []).map((m) => m.user_id),
      ...(projMemberships ?? []).map((m) => m.user_id),
    ]),
  );
  const { data: profiles } =
    allUserIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", allUserIds)
      : { data: [] as { id: string; display_name: string | null; avatar_url: string | null }[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const orgMembers = (orgMemberships ?? []).map((m) => ({
    user_id: m.user_id,
    org_role: m.role as "owner" | "admin" | "member" | "theme_owner",
    display_name: profileById.get(m.user_id)?.display_name ?? null,
  }));

  const projMembers = (projMemberships ?? []).map((m) => ({
    id: m.id,
    user_id: m.user_id,
    role: m.role as "lead" | "member",
    title: m.title,
    responsibility: m.responsibility,
    work_description: m.work_description,
    created_at: m.created_at,
    display_name: profileById.get(m.user_id)?.display_name ?? null,
    avatar_url: profileById.get(m.user_id)?.avatar_url ?? null,
    isMe: m.user_id === (user?.id ?? ""),
  }));

  // ── 集計 ────────────────────────────────────────────
  const budgetMonths = new Set(
    (budgetItems ?? [])
      .map((b) => b.month)
      .filter((m): m is number => typeof m === "number"),
  ).size;

  const retroSubmittedUserIds = new Set(
    (retroSubmitters ?? [])
      .map((r) => r.user_id)
      .filter((u): u is string => !!u),
  );
  const memberUserIds = new Set(projMembers.map((m) => m.user_id));
  const retroSubmittedUserCount = Array.from(memberUserIds).filter((uid) =>
    retroSubmittedUserIds.has(uid),
  ).length;

  let kpiCount = 0;
  let kpiProgressList: number[] = [];
  if (plan?.id) {
    const { data: kpis } = await supabase
      .from("kpis")
      .select("id, progress")
      .eq("plan_id", plan.id);
    kpiCount = (kpis ?? []).length;
    kpiProgressList = (kpis ?? []).map((k) =>
      typeof k.progress === "number" ? k.progress : 0,
    );
  }

  const planScores =
    plan?.scores && typeof plan.scores === "object"
      ? (plan.scores as {
          why?: number;
          who?: number;
          what?: number;
          how?: number;
        })
      : null;

  const snapshot = {
    meetingsCount: meetingsCount ?? 0,
    recurringMeetingsCount: recurringMeetingsCount ?? 0,
    plan: plan
      ? {
          why: plan.why,
          who: plan.who,
          what: plan.what,
          how: plan.how,
          product: plan.product,
          price: plan.price,
          place: plan.place,
          promotion: plan.promotion,
          qualitative_goal: plan.qualitative_goal,
          scores: planScores,
          last_observation: plan.last_observation ?? null,
        }
      : null,
    kpiCount,
    milestonesCount: milestonesTotal ?? 0,
    tasksCount: tasksTotal ?? 0,
    budgetMonths,
    retroSubmittedUserCount,
    memberCount: projMembers.length,
  };

  const score = computeProjectScore({
    planScores,
    members: projMembers.map((m) => ({
      role: m.role,
      title: m.title,
      responsibility: m.responsibility,
      work_description: m.work_description,
    })),
    taskTotal: tasksTotal ?? 0,
    taskDone: tasksDone ?? 0,
    milestoneTotal: milestonesTotal ?? 0,
    milestoneDone: milestonesDone ?? 0,
    streakDays: current.streak_days,
    retroSubmittedUserCount,
    memberCount: projMembers.length,
    kpiProgressList,
  });

  // ── 既存 DiagBoard 用データ ───────────────────────
  const diagMembers = projMembers.map((m) => ({
    user_id: m.user_id,
    role: m.role,
    display_name: m.display_name,
  }));

  return (
    <TeamManagementBody
      key={current.id}
      orgSlug={orgSlug}
      projectId={current.id}
      projectName={current.name}
      startedAt={current.started_at}
      badges={current.badges ?? []}
      canManage={Boolean(canManage)}
      orgMembers={orgMembers}
      initialMembers={projMembers}
      snapshot={snapshot}
      score={score}
      legacySchema={legacySchema}
      retroBoard={
        <DiagBoard
          orgSlug={orgSlug}
          projects={projects}
          current={current}
          currentUserId={user?.id ?? null}
          members={diagMembers}
          initialEntries={entries ?? []}
        />
      }
    />
  );
}
