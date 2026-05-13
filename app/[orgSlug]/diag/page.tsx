import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { pickCurrentProject, listOrgProjects } from "@/lib/projects";
import { DiagBoard } from "@/components/diag/DiagBoard";
import { GlassCard } from "@/components/ui/GlassCard";

export const dynamic = "force-dynamic";

export default async function DiagPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { orgSlug } = await params;
  const { p } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="t-h2 mb-1">診断レポートはプロジェクトが必要です</h2>
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

  // プロジェクトメンバー一覧 + プロファイル
  const { data: pms } = await supabase
    .from("project_memberships")
    .select("user_id, role, profiles:user_id(display_name, avatar_url)")
    .eq("project_id", current.id);

  type Profile = { display_name: string | null; avatar_url: string | null };
  const members = ((pms ?? []) as unknown as {
    user_id: string;
    role: "lead" | "member";
    profiles: Profile | Profile[] | null;
  }[]).map((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      user_id: m.user_id,
      role: m.role,
      display_name: p?.display_name ?? null,
    };
  });

  // 全エントリー（最近100件）
  const { data: entries } = await supabase
    .from("diagnosis_entries")
    .select("*")
    .eq("project_id", current.id)
    .order("entry_date", { ascending: false })
    .limit(200);

  return (
    <DiagBoard
      orgSlug={orgSlug}
      projects={projects}
      current={current}
      currentUserId={user?.id ?? null}
      members={members}
      initialEntries={entries ?? []}
    />
  );
}
