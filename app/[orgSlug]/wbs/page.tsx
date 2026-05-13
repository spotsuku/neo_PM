import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { pickCurrentProject, listOrgProjects } from "@/lib/projects";
import { WbsBoard } from "@/components/wbs/WbsBoard";
import { GlassCard } from "@/components/ui/GlassCard";

export default async function WbsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ p?: string; view?: string }>;
}) {
  const { orgSlug } = await params;
  const { p, view } = await searchParams;
  const supabase = await createClient();
  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) {
    return <div className="p-8 text-error">組織が見つかりません</div>;
  }

  const projects = await listOrgProjects(supabase, org.id);
  const current = await pickCurrentProject(supabase, org.id, p);

  if (!current) {
    return (
      <div className="max-w-xl mx-auto">
        <GlassCard className="p-10 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h2 className="t-h2 mb-1">WBS はプロジェクトが必要です</h2>
          <p className="t-cap mb-6">まず最初のプロジェクトを立ち上げましょう。</p>
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
