import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import {
  fetchMemberActivity,
  fetchOrgSummary,
  fetchProjectStats,
} from "@/lib/admin";
import { AdminBoard } from "@/components/admin/AdminBoard";
import { GlassCard } from "@/components/ui/GlassCard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "管理者ダッシュボード — AI PM",
};

export default async function AdminPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  // 権限チェック
  const { data: myMembership } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    !myMembership ||
    (myMembership.role !== "owner" && myMembership.role !== "admin")
  ) {
    return (
      <div className="max-w-xl mx-auto">
        <GlassCard className="p-10 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="t-h2 mb-1">管理者専用ページ</h2>
          <p className="t-cap mb-6">
            このページは組織 owner / admin のみアクセスできます。
          </p>
          <Link
            href={`/${orgSlug}`}
            className="inline-block rounded-full bg-ink px-6 py-3 text-[13px] font-semibold text-white"
          >
            ← ランキングへ戻る
          </Link>
        </GlassCard>
      </div>
    );
  }

  const projectStats = await fetchProjectStats(supabase, org.id);
  const memberActivity = await fetchMemberActivity(supabase, org.id);
  const summary = await fetchOrgSummary(
    supabase,
    org.id,
    projectStats,
    memberActivity,
  );

  // クエスト + アイテム
  const { data: quests } = await supabase
    .from("quests")
    .select("*")
    .eq("organization_id", org.id)
    .eq("status", "active")
    .order("ends_at", { ascending: true });

  const { data: questItems } = await supabase
    .from("quest_items")
    .select("*")
    .in("quest_id", (quests ?? []).map((q) => q.id).length > 0
      ? (quests ?? []).map((q) => q.id)
      : ["__none__"])
    .order("position", { ascending: true });

  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);

  // バッジ + 付与一覧
  const { data: badges } = await supabase
    .from("badges")
    .select("*")
    .eq("organization_id", org.id)
    .order("position", { ascending: true });

  const badgeIds = (badges ?? []).map((b) => b.id);
  const { data: badgeAwards } = await supabase
    .from("badge_awards")
    .select("*")
    .in("badge_id", badgeIds.length > 0 ? badgeIds : ["__none__"]);

  // 審査キュー: 公開申請中プロジェクト + 申請中テーマ
  const [{ data: pendingProjects }, { data: pendingThemes }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, name, team_name, idea_title, publish_submitted_at")
        .eq("organization_id", org.id)
        .eq("visibility", "submitted")
        .order("publish_submitted_at", { ascending: true }),
      supabase
        .from("themes")
        .select("id, code, title, company_name, submitted_at")
        .eq("organization_id", org.id)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: true }),
    ]);

  return (
    <AdminBoard
      orgSlug={orgSlug}
      orgId={org.id}
      orgName={org.name}
      summary={summary}
      projectStats={projectStats}
      memberActivity={memberActivity}
      quests={quests ?? []}
      questItems={questItems ?? []}
      badges={badges ?? []}
      badgeAwards={badgeAwards ?? []}
      hasAnthropic={hasAnthropic}
      canDeleteProjects={
        myMembership.role === "owner" || myMembership.role === "admin"
      }
      pendingProjects={pendingProjects ?? []}
      pendingThemes={pendingThemes ?? []}
    />
  );
}
