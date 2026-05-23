import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { listOrgProjects } from "@/lib/projects";
import { guardProjectTab } from "@/lib/projectTabGuard";
import { fetchProjectMembersSafe } from "@/lib/projectMembershipSafe";
import { WbsBoard } from "@/components/wbs/WbsBoard";

export const dynamic = "force-dynamic";

export default async function WbsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const { view } = await searchParams;
  const supabase = await createClient();
  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) {
    return <div className="p-8 text-error">組織が見つかりません</div>;
  }

  const projects = await listOrgProjects(supabase, org.id);
  const { current, gate } = await guardProjectTab(
    supabase,
    org.id,
    projectId,
    orgSlug,
    "WBS",
  );
  if (gate) return gate;

  const [{ data: tasks }, { data: milestones }, memberResult] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .eq("project_id", current.id)
        .order("start_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("milestones")
        .select("*")
        .eq("project_id", current.id)
        .order("date", { ascending: true, nullsFirst: false }),
      fetchProjectMembersSafe(supabase, current.id),
    ]);

  // 担当者選択用: プロジェクトメンバーの表示名を取得
  const memberUserIds = memberResult.members.map((m) => m.user_id);
  const { data: memberProfiles } =
    memberUserIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", memberUserIds)
      : { data: [] as { id: string; display_name: string | null }[] };
  const nameById = new Map(
    (memberProfiles ?? []).map((p) => [p.id, p.display_name]),
  );
  const assignees = memberResult.members.map((m) => ({
    user_id: m.user_id,
    display_name: nameById.get(m.user_id) ?? "(名前未設定)",
  }));

  const initialView =
    view === "tree" || view === "kanban" ? view : ("gantt" as const);

  return (
    <WbsBoard
      orgSlug={orgSlug}
      projects={projects}
      current={current}
      initialTasks={tasks ?? []}
      initialMilestones={milestones ?? []}
      initialView={initialView}
      assignees={assignees}
    />
  );
}
