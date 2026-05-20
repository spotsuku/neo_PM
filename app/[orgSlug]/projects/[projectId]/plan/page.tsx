import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { listOrgProjects } from "@/lib/projects";
import { getProjectForOrgOrNotFound } from "@/lib/getProject";
import { PlanEditor } from "@/components/plan/PlanEditor";

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
  const current = await getProjectForOrgOrNotFound(supabase, org.id, projectId);

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
