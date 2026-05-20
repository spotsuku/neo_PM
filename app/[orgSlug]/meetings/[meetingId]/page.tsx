import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { redirectToProjectScope } from "@/lib/redirectToProjectScope";

export default async function LegacyMeetingDetailRedirect({
  params,
}: {
  params: Promise<{ orgSlug: string; meetingId: string }>;
}) {
  const { orgSlug, meetingId } = await params;
  const supabase = await createClient();
  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  // 会議の project_id を取得して、新 URL に redirect
  const { data: meeting } = await supabase
    .from("meetings")
    .select("project_id, projects:project_id(organization_id)")
    .eq("id", meetingId)
    .maybeSingle();
  if (!meeting) notFound();
  type Lite = { organization_id: string };
  const raw = (meeting as unknown as { projects: Lite | Lite[] | null }).projects;
  const proj = Array.isArray(raw) ? raw[0] : raw;
  if (!proj || proj.organization_id !== org.id) notFound();

  await redirectToProjectScope(
    supabase,
    { id: org.id, slug: orgSlug },
    meeting.project_id,
    "meetings",
    meetingId,
  );
}
