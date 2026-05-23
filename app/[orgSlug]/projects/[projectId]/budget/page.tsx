import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { listOrgProjects } from "@/lib/projects";
import { guardProjectTab } from "@/lib/projectTabGuard";
import { BudgetTabs } from "@/components/budget/BudgetTabs";
import { DesktopOnly } from "@/components/ui/DesktopOnly";
import type { BreakevenData } from "@/components/budget/BreakevenModel";

export const dynamic = "force-dynamic";

const EMPTY_BE: BreakevenData = { phases: [], revenues: [], fixed: [] };

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
  const { current, gate } = await guardProjectTab(
    supabase,
    org.id,
    projectId,
    orgSlug,
    "収支",
  );
  if (gate) return gate;

  const [{ data: items }, { data: beRow }] = await Promise.all([
    supabase
      .from("budget_items")
      .select("*")
      .eq("project_id", current.id)
      .order("kind", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("breakeven_plans")
      .select("data")
      .eq("project_id", current.id)
      .maybeSingle(),
  ]);

  const breakeven = (beRow?.data as BreakevenData | undefined) ?? EMPTY_BE;

  return (
    <DesktopOnly tabLabel="収支">
      <BudgetTabs
        orgSlug={orgSlug}
        projects={projects}
        current={current}
        initialItems={items ?? []}
        projectId={current.id}
        initialBreakeven={breakeven}
      />
    </DesktopOnly>
  );
}
