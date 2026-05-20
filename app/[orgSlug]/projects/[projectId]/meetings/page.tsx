import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { listOrgProjects } from "@/lib/projects";
import { getProjectForOrgOrNotFound } from "@/lib/getProject";
import { MeetingsBoard } from "@/components/meetings/MeetingsBoard";

export default async function MeetingsPage({
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
  const current = await getProjectForOrgOrNotFound(supabase, org.id, projectId);

  const [
    { data: meetings },
    { data: actionItemCounts },
    { data: recurrences },
  ] = await Promise.all([
    supabase
      .from("meetings")
      .select("*")
      .eq("project_id", current.id)
      .order("scheduled_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("action_items")
      .select("meeting_id, status")
      .eq("project_id", current.id),
    supabase
      .from("meeting_recurrences")
      .select("*")
      .eq("project_id", current.id)
      .eq("active", true)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <MeetingsBoard
      orgSlug={orgSlug}
      projects={projects}
      current={current}
      initialMeetings={meetings ?? []}
      actionCounts={actionItemCounts ?? []}
      initialRecurrences={recurrences ?? []}
    />
  );
}
