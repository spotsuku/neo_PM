import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { listOrgProjects } from "@/lib/projects";
import { resolveProjectOrRedirect } from "@/lib/resolveProjectOrRedirect";
import { AICompanion } from "@/components/ai/AICompanion";
import { GlassCard } from "@/components/ui/GlassCard";

export default async function AIPage({
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
    "ai",
  );

  if (!current) {
    return (
      <div className="max-w-xl mx-auto">
        <GlassCard className="p-10 text-center">
          <div className="text-5xl mb-4">✨</div>
          <h2 className="t-h2 mb-1">AI 伴走者はプロジェクトが必要です</h2>
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
