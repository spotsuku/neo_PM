import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { ProjectMembersPanel } from "@/components/projects/ProjectMembersPanel";
import { GlassCard } from "@/components/ui/GlassCard";

export const dynamic = "force-dynamic";

export default async function ProjectMembersPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("organization_id", org.id)
    .maybeSingle();
  if (!project) notFound();

  const { data: canManage } = await supabase.rpc("can_manage_project", {
    p_project_id: projectId,
  });

  // 組織メンバー全員（プルダウン候補用）
  const { data: orgMemberships } = await supabase
    .from("memberships")
    .select(
      "user_id, role, profiles:user_id(display_name, avatar_url)",
    )
    .eq("organization_id", org.id);

  // プロジェクト メンバー
  const { data: projMemberships } = await supabase
    .from("project_memberships")
    .select(
      "id, user_id, role, created_at, profiles:user_id(display_name, avatar_url)",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  type Profile = { display_name: string | null; avatar_url: string | null };

  const orgMembers = ((orgMemberships ?? []) as unknown as {
    user_id: string;
    role: "owner" | "admin" | "member";
    profiles: Profile | Profile[] | null;
  }[]).map((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      user_id: m.user_id,
      org_role: m.role,
      display_name: p?.display_name ?? null,
    };
  });

  const projMembers = ((projMemberships ?? []) as unknown as {
    id: string;
    user_id: string;
    role: "lead" | "member";
    created_at: string;
    profiles: Profile | Profile[] | null;
  }[]).map((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      created_at: m.created_at,
      display_name: p?.display_name ?? null,
      isMe: m.user_id === user.id,
    };
  });

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <header>
        <Link href={`/${orgSlug}/dashboard?p=${project.id}`} className="t-cap underline">
          ← {project.name} のダッシュボードへ
        </Link>
        <h1 className="t-h2 mt-2">
          <span aria-hidden className="mr-2">
            👥
          </span>
          プロジェクトメンバー
        </h1>
        <p className="t-cap mt-1">
          {project.name} — {projMembers.length} 名
        </p>
      </header>

      <ProjectMembersPanel
        projectId={project.id}
        canManage={Boolean(canManage)}
        orgMembers={orgMembers}
        initialMembers={projMembers}
      />

      <GlassCard className="p-4">
        <h3 className="t-h3 mb-2">
          <span aria-hidden className="mr-2">
            💡
          </span>
          プロジェクトメンバーとは
        </h3>
        <ul className="text-[12.5px] leading-relaxed text-mute space-y-1.5">
          <li>・プロジェクトに登録されたメンバーだけがダッシュボード・WBS・実行計画・収支・診断・基金申請・AI伴走を見られます。</li>
          <li>・ランキングページは組織メンバー全員に公開（概要のみ、🔒 表示）。</li>
          <li>・組織の owner / admin は登録外でも全プロジェクトにアクセス可能。</li>
          <li>・プロジェクトリード（作成者）と組織 admin/owner がメンバー追加・削除できます。</li>
        </ul>
      </GlassCard>
    </div>
  );
}
