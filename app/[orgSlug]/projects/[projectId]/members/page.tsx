import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { MembersPageBody } from "@/components/projects/MembersPageBody";
import { GlassCard } from "@/components/ui/GlassCard";

export const dynamic = "force-dynamic";

export default async function ProjectMembersPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("organization_id", org.id)
    .maybeSingle();
  if (!project) notFound();

  const { data: canManage } = await supabase.rpc("can_manage_project", {
    p_project_id: projectId,
  });

  // 組織メンバー全員 + プロジェクトメンバー (どちらも profiles の embedded join は
  // PostgREST の関係推論で空配列を返す可能性があるので、profiles は別クエリで取得)
  const [
    { data: orgMemberships },
    { data: projMemberships },
  ] = await Promise.all([
    supabase
      .from("memberships")
      .select("user_id, role")
      .eq("organization_id", org.id),
    supabase
      .from("project_memberships")
      .select(
        "id, user_id, role, title, responsibility, work_description, created_at",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
  ]);

  // 全 user_id を集めて profiles を 1 クエリで取る
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
    isMe: m.user_id === user.id,
  }));

  // ── Launch readiness の集計を並列で取得 ────────────────────
  const [
    { count: meetingsCount },
    { data: plan },
    { data: kpisData },
    { count: milestonesCount },
    { count: tasksCount },
    { data: budgetItems },
  ] = await Promise.all([
    supabase
      .from("meetings")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId),
    supabase
      .from("execution_plans")
      .select(
        "id, why, who, what, how, product, price, place, promotion, qualitative_goal, scores",
      )
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("kpis")
      .select("id, plan_id")
      .eq("plan_id", "00000000-0000-0000-0000-000000000000")
      .limit(0), // placeholder; fill below if plan exists
    supabase
      .from("milestones")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId),
    supabase
      .from("budget_items")
      .select("month")
      .eq("project_id", projectId)
      .not("month", "is", null),
  ]);
  void kpisData; // placeholder

  let kpiCount = 0;
  if (plan?.id) {
    const { count } = await supabase
      .from("kpis")
      .select("*", { count: "exact", head: true })
      .eq("plan_id", plan.id);
    kpiCount = count ?? 0;
  }

  const budgetMonths = new Set(
    (budgetItems ?? [])
      .map((b) => b.month)
      .filter((m): m is number => typeof m === "number"),
  ).size;

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
    recurringMeetingsCount: 0, // 専用テーブル登場までは 0 固定
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
        }
      : null,
    kpiCount,
    milestonesCount: milestonesCount ?? 0,
    tasksCount: tasksCount ?? 0,
    budgetMonths,
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <header>
        <Link href={`/${orgSlug}/dashboard?p=${project.id}`} className="t-cap underline">
          ← {project.name} のダッシュボードへ
        </Link>
        <h1 className="t-h2 mt-2">
          <span aria-hidden className="mr-2">
            👥
          </span>
          プロジェクトメンバー
        </h1>
        <p className="t-cap mt-1">
          {project.name} — {projMembers.length} 名
        </p>
      </header>

      <MembersPageBody
        orgSlug={orgSlug}
        projectId={project.id}
        projectName={project.name}
        startedAt={project.started_at}
        badges={project.badges ?? []}
        canManage={Boolean(canManage)}
        orgMembers={orgMembers}
        initialMembers={projMembers}
        snapshot={snapshot}
      />

      <GlassCard className="p-4">
        <h3 className="t-h3 mb-2">
          <span aria-hidden className="mr-2">
            💡
          </span>
          プロジェクトメンバーとは
        </h3>
        <ul className="text-[12.5px] leading-relaxed text-mute space-y-1.5">
          <li>・プロジェクトに登録されたメンバーだけがダッシュボード・WBS・実行計画・収支・診断・基金申請・AI伴走を見られます。</li>
          <li>・ランキングページは組織メンバー全員に公開（概要のみ、🔒 表示）。</li>
          <li>・組織の owner / admin は登録外でも全プロジェクトにアクセス可能。</li>
          <li>・プロジェクトリード（作成者）と組織 admin/owner がメンバー追加・削除できます。</li>
        </ul>
      </GlassCard>
    </div>
  );
}
