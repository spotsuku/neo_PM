import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { listOrgProjects } from "@/lib/projects";
import { resolveProjectOrRedirect } from "@/lib/resolveProjectOrRedirect";
import { FundBoard } from "@/components/fund/FundBoard";
import { GlassCard } from "@/components/ui/GlassCard";

export default async function FundPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ p?: string; id?: string }>;
}) {
  const { orgSlug } = await params;
  const { p, id } = await searchParams;
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
    "fund",
  );

  if (!current) {
    return (
      <div className="max-w-xl mx-auto">
        <GlassCard className="p-10 text-center">
          <div className="text-5xl mb-4">📨</div>
          <h2 className="t-h2 mb-1">基金申請はプロジェクトが必要です</h2>
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
