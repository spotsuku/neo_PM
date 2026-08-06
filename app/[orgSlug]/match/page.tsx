import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { TeamThemeMap } from "@/components/match/TeamThemeMap";
import { GlassCard } from "@/components/ui/GlassCard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "テーマ × チーム マップ — AI PM",
};

export default async function MatchPage({
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
          この組織では「マッチング」を利用できません
        </h1>
        <p className="t-cap">
          テーマ応募機能 (competition mode) を有効にした組織のみ利用できます。
        </p>
      </GlassCard>
    );
  }

  // 組織メンバー全員
  const { data: memberships } = await supabase
    .from("memberships")
    .select("user_id, role")
    .eq("organization_id", org.id);
  const memberUserIds = (memberships ?? []).map((m) => m.user_id);

  const { data: profiles } =
    memberUserIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", memberUserIds)
      : {
          data: [] as {
            id: string;
            display_name: string | null;
            avatar_url: string | null;
          }[],
        };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  // 公開中テーマ (approved / active)
  const { data: themesData } = await supabase
    .from("themes")
    .select("id, code, title, posted_by, status")
    .eq("organization_id", org.id)
    .in("status", ["approved", "active"])
    .order("code", { ascending: true, nullsFirst: false });
  const themes = themesData ?? [];
  const themeIds = themes.map((t) => t.id);

  // theme_preferences (全メンバー × 全ランク)
  const { data: prefsData } =
    themeIds.length > 0
      ? await supabase
          .from("theme_preferences")
          .select("user_id, theme_id, preference_rank")
          .eq("organization_id", org.id)
          .in("theme_id", themeIds)
      : {
          data: [] as {
            user_id: string;
            theme_id: string;
            preference_rank: number;
          }[],
        };

  // チーム (active) + members
  const { data: teamsData } = await supabase
    .from("teams")
    .select("id, name, description, created_by")
    .eq("organization_id", org.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  const teams = teamsData ?? [];
  const teamIds = teams.map((t) => t.id);

  const { data: teamMembersData } =
    teamIds.length > 0
      ? await supabase
          .from("team_members")
          .select("team_id, user_id, role")
          .in("team_id", teamIds)
      : {
          data: [] as {
            team_id: string;
            user_id: string;
            role: "lead" | "member";
          }[],
        };

  // 応募状況 (team_id が入っているもののみ)
  const { data: appsData } =
    teamIds.length > 0
      ? await supabase
          .from("theme_applications")
          .select("id, team_id, theme_id, status, preference_rank")
          .in("team_id", teamIds)
      : {
          data: [] as {
            id: string;
            team_id: string | null;
            theme_id: string;
            status: string;
            preference_rank: number | null;
          }[],
        };

  // メンバー配列を構造化
  const orgMembers = (memberships ?? []).map((m) => {
    const prof = profileById.get(m.user_id);
    return {
      user_id: m.user_id,
      display_name: prof?.display_name ?? null,
      avatar_url: prof?.avatar_url ?? null,
    };
  });

  // チーム所属状況
  const affiliatedUserIds = new Set(
    (teamMembersData ?? []).map((tm) => tm.user_id),
  );
  const unaffiliated = orgMembers.filter(
    (m) => !affiliatedUserIds.has(m.user_id),
  );

  // 未所属ユーザーの希望テーマを user_id -> [{theme_id, rank}] で集計
  const prefsByUser = new Map<
    string,
    { theme_id: string; rank: number }[]
  >();
  for (const p of prefsData ?? []) {
    const arr = prefsByUser.get(p.user_id) ?? [];
    arr.push({ theme_id: p.theme_id, rank: p.preference_rank });
    prefsByUser.set(p.user_id, arr);
  }
  for (const arr of prefsByUser.values()) {
    arr.sort((a, b) => a.rank - b.rank);
  }

  // 各テーマの希望登録者を rank 別に集計
  const prefsByTheme = new Map<
    string,
    { user_id: string; rank: number }[]
  >();
  for (const p of prefsData ?? []) {
    const arr = prefsByTheme.get(p.theme_id) ?? [];
    arr.push({ user_id: p.user_id, rank: p.preference_rank });
    prefsByTheme.set(p.theme_id, arr);
  }

  // チームメンバー集計
  const membersByTeam = new Map<
    string,
    { user_id: string; role: "lead" | "member" }[]
  >();
  for (const tm of teamMembersData ?? []) {
    const arr = membersByTeam.get(tm.team_id) ?? [];
    arr.push({ user_id: tm.user_id, role: tm.role });
    membersByTeam.set(tm.team_id, arr);
  }

  // 応募集計 (team_id -> theme_id -> app info)
  const appsByTeam = new Map<
    string,
    { id: string; theme_id: string; status: string; preference_rank: number | null }[]
  >();
  for (const a of appsData ?? []) {
    if (!a.team_id) continue;
    const arr = appsByTeam.get(a.team_id) ?? [];
    arr.push({
      id: a.id,
      theme_id: a.theme_id,
      status: a.status,
      preference_rank: a.preference_rank,
    });
    appsByTeam.set(a.team_id, arr);
  }

  // 自分の team_id
  const myTeamId =
    (teamMembersData ?? []).find((tm) => tm.user_id === user.id)?.team_id ??
    null;

  // データを整理して view に渡す
  const themesForView = themes.map((t) => {
    const prefs = prefsByTheme.get(t.id) ?? [];
    const memberIdsByRank = new Map<number, string[]>();
    for (const p of prefs) {
      const arr = memberIdsByRank.get(p.rank) ?? [];
      arr.push(p.user_id);
      memberIdsByRank.set(p.rank, arr);
    }
    // 応募中チーム (このテーマに応募している team)
    const appliedTeamIds = (appsData ?? [])
      .filter((a) => a.theme_id === t.id && a.team_id)
      .map((a) => ({
        team_id: a.team_id!,
        status: a.status,
        preference_rank: a.preference_rank,
      }));
    return {
      id: t.id,
      code: t.code,
      title: t.title,
      posted_by: t.posted_by,
      totalInterest: prefs.length,
      byRank: {
        rank1: (memberIdsByRank.get(1) ?? []).slice(),
        rank2: (memberIdsByRank.get(2) ?? []).slice(),
        rank3to5: [
          ...(memberIdsByRank.get(3) ?? []),
          ...(memberIdsByRank.get(4) ?? []),
          ...(memberIdsByRank.get(5) ?? []),
        ],
      },
      appliedTeams: appliedTeamIds,
    };
  });

  // 希望登録者が多い順に並び替え
  themesForView.sort((a, b) => b.totalInterest - a.totalInterest);

  const teamsForView = teams.map((t) => ({
    id: t.id,
    name: t.name,
    members: (membersByTeam.get(t.id) ?? []).map((tm) => tm.user_id),
    applications: appsByTeam.get(t.id) ?? [],
  }));

  const unaffiliatedForView = unaffiliated.map((u) => ({
    user_id: u.user_id,
    display_name: u.display_name,
    avatar_url: u.avatar_url,
    top_prefs: (prefsByUser.get(u.user_id) ?? []).slice(0, 5),
  }));

  return (
    <TeamThemeMap
      orgSlug={orgSlug}
      currentUserId={user.id}
      myTeamId={myTeamId}
      themes={themesForView}
      teams={teamsForView}
      orgMembers={orgMembers}
      unaffiliated={unaffiliatedForView}
    />
  );
}
