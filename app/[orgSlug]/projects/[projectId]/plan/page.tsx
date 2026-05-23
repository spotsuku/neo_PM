import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { listOrgProjects } from "@/lib/projects";
import { guardProjectTab } from "@/lib/projectTabGuard";
import { PlanEditor } from "@/components/plan/PlanEditor";

export const dynamic = "force-dynamic";

export default async function PlanPage({
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
    "実行計画",
  );
  if (gate) return gate;

  // Plan を取得、無ければ作る（古いプロジェクト互換）
  const { data: existing } = await supabase
    .from("execution_plans")
    .select("*")
    .eq("project_id", current.id)
    .maybeSingle();

  let plan = existing;
  if (!plan) {
    const { data: created } = await supabase
      .from("execution_plans")
      .insert({ project_id: current.id })
      .select()
      .single();
    plan = created;
  }
  if (!plan) {
    redirect(`/${orgSlug}/projects/${current.id}/dashboard`);
  }

  const { data: kpis } = await supabase
    .from("kpis")
    .select("*")
    .eq("plan_id", plan.id)
    .order("created_at", { ascending: true });

  return (
    <PlanEditor
      orgSlug={orgSlug}
      projects={projects}
      current={current}
      plan={plan}
      kpis={kpis ?? []}
    />
  );
}
