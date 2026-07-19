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
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ round?: string }>;
}) {
  const { orgSlug } = await params;
  const { round: roundQuery } = await searchParams;
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

  const isAdmin =
    myMembership.role === "owner" || myMembership.role === "admin";

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

  // 意識調査の回一覧
  const { data: roundsRaw } = await supabase
    .from("survey_rounds")
    .select("id, label, round_number, opens_at, closes_at")
    .eq("organization_id", org.id)
    .order("round_number", { ascending: true });
  const rounds = roundsRaw ?? [];

  // 現在時刻で「開催中」の回を探す (URL param がなければこれを選ぶ)
  const now = new Date();
  const activeRound = rounds.find((r) => {
    const opens = new Date(r.opens_at);
    const closes = new Date(r.closes_at);
    return opens <= now && now <= closes;
  });
  const upcomingRound = rounds.find((r) => new Date(r.opens_at) > now);
  const lastRound = rounds[rounds.length - 1];
  const defaultRound = activeRound ?? upcomingRound ?? lastRound ?? null;

  const selectedRoundId = roundQuery ?? defaultRound?.id ?? null;
  const selectedRound = rounds.find((r) => r.id === selectedRoundId) ?? null;

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

  // 選択中の回のみの希望 (集計 + 自分の希望)
  const { data: prefs } = selectedRoundId
    ? await supabase
        .from("theme_preferences")
        .select("id, user_id, theme_id, preference_rank, updated_at")
        .eq("organization_id", org.id)
        .eq("survey_round_id", selectedRoundId)
    : { data: [] as never[] };

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
      isAdmin={isAdmin}
      themes={themes}
      rounds={rounds}
      selectedRound={selectedRound}
      preferences={preferencesData}
      memberCount={memberCount ?? 0}
    />
  );
}
