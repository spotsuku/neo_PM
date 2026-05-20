import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { listOrgProjects } from "@/lib/projects";
import { getProjectForOrgOrNotFound } from "@/lib/getProject";
import { FundBoard } from "@/components/fund/FundBoard";

export const dynamic = "force-dynamic";

export default async function FundPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const { id } = await searchParams;
  const supabase = await createClient();
  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) {
    return <div className="p-8 text-error">組織が見つかりません</div>;
  }

  const projects = await listOrgProjects(supabase, org.id);
  const current = await getProjectForOrgOrNotFound(supabase, org.id, projectId);

  const { data: apps } = await supabase
    .from("fund_applications")
    .select("*")
    .eq("project_id", current.id)
    .order("created_at", { ascending: false });

  return (
    <FundBoard
      orgSlug={orgSlug}
      projects={projects}
      current={current}
      initialApps={apps ?? []}
      activeId={id ?? null}
    />
  );
}
