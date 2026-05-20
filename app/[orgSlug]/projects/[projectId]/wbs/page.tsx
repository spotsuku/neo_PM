import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { listOrgProjects } from "@/lib/projects";
import { getProjectForOrgOrNotFound } from "@/lib/getProject";
import { WbsBoard } from "@/components/wbs/WbsBoard";

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
  const current = await getProjectForOrgOrNotFound(supabase, org.id, projectId);

  const [{ data: tasks }, { data: milestones }] = await Promise.all([
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
  ]);

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
    />
  );
}
