import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { listOrgProjects } from "@/lib/projects";
import { resolveProjectOrRedirect } from "@/lib/resolveProjectOrRedirect";
import { PlanEditor } from "@/components/plan/PlanEditor";
import { GlassCard } from "@/components/ui/GlassCard";
import Link from "next/link";

export default async function PlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { orgSlug } = await params;
  const { p } = await searchParams;
  const supabase = await createClient();
  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) {
    return <div className="p-8 text-error">組織が見つかりません</div>;
  }

  const projects = await listOrgProjects(supabase, org.id);
  const current = await resolveProjectOrRedirect(
    supabase,
    { id: org.id, slug: orgSlug },
    p ?? null,
    "plan",
  );

  if (!current) {
    return (
      <div className="max-w-xl mx-auto">
        <GlassCard className="p-10 text-center">
          <div className="text-5xl mb-4">🎯</div>
          <h2 className="t-h2 mb-1">実行計画はプロジェクトが必要です</h2>
          <p className="t-cap mb-6">
            まず最初のプロジェクトを立ち上げましょう。
          </p>
          <Link
            href={`/${orgSlug}/projects/new`}
            className="inline-block rounded-full bg-ink px-6 py-3 text-[13px] font-semibold text-white"
          >
            ＋ 新規プロジェクト
          </Link>
        </GlassCard>
      </div>
    );
  }

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
    redirect(`/${orgSlug}/dashboard`);
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
