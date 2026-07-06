import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { SurveyBoard } from "@/components/survey/SurveyBoard";
import { GlassCard } from "@/components/ui/GlassCard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "意識調査 — AI PM",
};

export default async function SurveyPage({
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

  const { data: myMembership } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!myMembership) notFound();

  if (!org.competition_enabled) {
    return (
      <GlassCard className="p-8 text-center flex flex-col gap-3">
        <span aria-hidden className="text-3xl">
          🔒
        </span>
        <h1 className="text-[18px] font-extrabold">
          この組織では「意識調査」を利用できません
        </h1>
        <p className="t-cap">
          テーマ応募機能 (competition mode) を有効にした組織のみ利用できます。
        </p>
      </GlassCard>
    );
  }

  // 組織内の公開中テーマ
  const { data: themesRaw } = await supabase
    .from("themes")
    .select("id, title, background")
    .eq("organization_id", org.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  const themes = (themesRaw ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.background,
  }));

  // 全メンバーの希望 (グラフ用)
  const { data: prefs } = await supabase
    .from("theme_preferences")
    .select("id, user_id, theme_id, preference_rank, updated_at")
    .eq("organization_id", org.id);

  // メンバー profile
  const userIds = Array.from(
    new Set((prefs ?? []).map((p) => p.user_id)),
  );
  const { data: profiles } =
    userIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds)
      : { data: [] as { id: string; display_name: string | null }[] };

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const preferencesData = (prefs ?? []).map((p) => ({
    id: p.id,
    user_id: p.user_id,
    theme_id: p.theme_id,
    preference_rank: p.preference_rank,
    display_name: profileById.get(p.user_id)?.display_name ?? "名前未設定",
    is_me: p.user_id === user.id,
  }));

  // 組織メンバー総数 (回答率算出用)
  const { count: memberCount } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id);

  return (
    <SurveyBoard
      orgSlug={orgSlug}
      orgId={org.id}
      orgName={org.name}
      currentUserId={user.id}
      themes={themes}
      preferences={preferencesData}
      memberCount={memberCount ?? 0}
    />
  );
}
