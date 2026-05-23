import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { listOrgProjects } from "@/lib/projects";
import { guardProjectTab } from "@/lib/projectTabGuard";
import { AICompanion } from "@/components/ai/AICompanion";

export const dynamic = "force-dynamic";

export default async function AIPage({
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
  const { current, gate } = await guardProjectTab(
    supabase,
    org.id,
    projectId,
    orgSlug,
    "AI伴走",
  );
  if (gate) return gate;

  const [{ data: messages }, { data: proposals }] = await Promise.all([
    supabase
      .from("chat_messages")
      .select("*")
      .eq("project_id", current.id)
      .order("created_at", { ascending: true })
      .limit(50),
    supabase
      .from("proposals")
      .select("*")
      .eq("project_id", current.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <AICompanion
      orgSlug={orgSlug}
      projects={projects}
      current={current}
      initialMessages={messages ?? []}
      initialProposals={proposals ?? []}
      hasAnthropic={hasAnthropic}
    />
  );
}
