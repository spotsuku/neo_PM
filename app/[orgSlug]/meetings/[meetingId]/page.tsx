import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { MeetingDetail } from "@/components/meetings/MeetingDetail";
import { GlassCard } from "@/components/ui/GlassCard";

export const dynamic = "force-dynamic";

export default async function MeetingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; meetingId: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { orgSlug, meetingId } = await params;
  const { p: explicitProjectId } = await searchParams;
  const supabase = await createClient();
  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const { data: meeting } = await supabase
    .from("meetings")
    .select("*, projects:project_id(id, name, organization_id)")
    .eq("id", meetingId)
    .maybeSingle();
  if (!meeting) notFound();

  type ProjLite = { id: string; name: string; organization_id: string };
  const raw = (meeting as unknown as { projects: ProjLite | ProjLite[] | null })
    .projects;
  const proj: ProjLite | null = Array.isArray(raw) ? (raw[0] ?? null) : raw;
  if (!proj || proj.organization_id !== org.id) notFound();

  // URL の ?p= が会議の所属プロジェクトと一致しない時は、正しい ?p= で
  // 再描画する。これでサイドバー / Header / cookie の "現在プロジェクト"
  // が会議の所属に同期し、別プロジェクトに切り替わったように見えるのを防ぐ。
  if (explicitProjectId !== proj.id) {
    redirect(`/${orgSlug}/meetings/${meetingId}?p=${proj.id}`);
  }

  const { data: actionItems } = await supabase
    .from("action_items")
    .select("*")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: true });

  // 組織メンバー (担当者プルダウン用)
  const { data: orgMemberships } = await supabase
    .from("memberships")
    .select("user_id, profiles:user_id(display_name)")
    .eq("organization_id", org.id);

  type Profile = { display_name: string | null };
  const orgMembers = ((orgMemberships ?? []) as unknown as {
    user_id: string;
    profiles: Profile | Profile[] | null;
  }[]).map((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return { user_id: m.user_id, display_name: p?.display_name ?? null };
  });

  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);

  // projects テーブル参照を除いた meeting row を渡す
  const meetingRow = { ...(meeting as Record<string, unknown>) };
  delete meetingRow.projects;

  return (
    <div className="flex flex-col gap-4 lg:gap-5 max-w-5xl mx-auto w-full">
      <header>
        <Link
          href={`/${orgSlug}/meetings?p=${proj.id}`}
          className="t-cap underline"
        >
          ← 会議一覧へ戻る
        </Link>
      </header>
      <MeetingDetail
        orgSlug={orgSlug}
        projectName={proj.name}
        projectId={proj.id}
        meeting={meetingRow as never}
        initialActionItems={actionItems ?? []}
        orgMembers={orgMembers}
        hasAnthropic={hasAnthropic}
      />
      <GlassCard className="p-4">
        <h3 className="t-h3 mb-2">
          <span aria-hidden className="mr-2">
            💡
          </span>
          会議のフロー
        </h3>
        <ul className="text-[12.5px] leading-relaxed text-mute space-y-1">
          <li>1. 会議前: 議題（Agenda）と参加者を確認</li>
          <li>2. 会議中: 議事録欄に決まった内容をメモ</li>
          <li>3. 会議後: 「✦ AI で Action Items を抽出」または手動で追加</li>
          <li>4. 担当・期日を確定 → 「タスク化」で WBS に反映</li>
        </ul>
      </GlassCard>
    </div>
  );
}
