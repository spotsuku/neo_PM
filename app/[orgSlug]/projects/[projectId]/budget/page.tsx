import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { listOrgProjects } from "@/lib/projects";
import { getProjectForOrgOrNotFound } from "@/lib/getProject";
import { BudgetBoard } from "@/components/budget/BudgetBoard";

export const dynamic = "force-dynamic";

export default async function BudgetPage({
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

  const { data: items } = await supabase
    .from("budget_items")
    .select("*")
    .eq("project_id", current.id)
    .order("kind", { ascending: false })
    .order("created_at", { ascending: true });

  return (
    <BudgetBoard
      orgSlug={orgSlug}
      projects={projects}
      current={current}
      initialItems={items ?? []}
    />
  );
}
