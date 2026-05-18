import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { pickCurrentProject, listOrgProjects } from "@/lib/projects";
import { MeetingsBoard } from "@/components/meetings/MeetingsBoard";
import { GlassCard } from "@/components/ui/GlassCard";

export default async function MeetingsPage({
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
  const current = await pickCurrentProject(supabase, org.id, p);

  if (!current) {
    return (
      <div className="max-w-xl mx-auto">
        <GlassCard className="p-10 text-center">
          <div className="text-5xl mb-4">📅</div>
          <h2 className="t-h2 mb-1">会議機能はプロジェクトが必要です</h2>
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

  const [
    { data: meetings },
    { data: actionItemCounts },
    { data: recurrences },
  ] = await Promise.all([
    supabase
      .from("meetings")
      .select("*")
      .eq("project_id", current.id)
      .order("scheduled_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("action_items")
      .select("meeting_id, status")
      .eq("project_id", current.id),
    supabase
      .from("meeting_recurrences")
      .select("*")
      .eq("project_id", current.id)
      .eq("active", true)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <MeetingsBoard
      orgSlug={orgSlug}
      projects={projects}
      current={current}
      initialMeetings={meetings ?? []}
      actionCounts={actionItemCounts ?? []}
      initialRecurrences={recurrences ?? []}
    />
  );
}
