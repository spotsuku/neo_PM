import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { TeamsBoard } from "@/components/teams/TeamsBoard";
import { GlassCard } from "@/components/ui/GlassCard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "チーム組成 — AI PM",
};

export default async function TeamsPage({
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

  // 自分の membership を先に確認 (未参加なら 404)
  const { data: myMembership } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!myMembership) notFound();

  const isAdmin =
    myMembership.role === "owner" || myMembership.role === "admin";

  // 組織メンバー全員 (未所属を割り出すため)
  const { data: memberships } = await supabase
    .from("memberships")
    .select("user_id, role, affiliation, title, created_at")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: true });

  const memberUserIds = (memberships ?? []).map((m) => m.user_id);
  const { data: profiles } =
    memberUserIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", memberUserIds)
      : { data: [] as { id: string; display_name: string | null; avatar_url: string | null }[] };

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const orgMembers = (memberships ?? []).map((m) => {
    const prof = profileById.get(m.user_id);
    return {
      user_id: m.user_id,
      role: m.role,
      display_name: prof?.display_name ?? null,
      avatar_url: prof?.avatar_url ?? null,
      affiliation: m.affiliation ?? null,
      title: m.title ?? null,
    };
  });

  // 組織内チーム (active)
  const { data: teamsData } = await supabase
    .from("teams")
    .select("id, name, description, status, created_by, created_at")
    .eq("organization_id", org.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  const teams = teamsData ?? [];
  const teamIds = teams.map((t) => t.id);

  const { data: teamMembersData } =
    teamIds.length > 0
      ? await supabase
          .from("team_members")
          .select("team_id, user_id, role, joined_at")
          .in("team_id", teamIds)
      : { data: [] as { team_id: string; user_id: string; role: "lead" | "member"; joined_at: string }[] };

  // チームの応募状況 (application status + 第何希望) : Phase 1 は「応募中件数」だけ表示
  const { data: appsData } =
    teamIds.length > 0
      ? await supabase
          .from("theme_applications")
          .select("id, team_id, theme_id, preference_rank, status")
          .in("team_id", teamIds)
      : { data: [] as { id: string; team_id: string | null; theme_id: string; preference_rank: number | null; status: string }[] };

  // テーマ名を引く
  const themeIdsForApps = Array.from(
    new Set((appsData ?? []).map((a) => a.theme_id)),
  );
  const { data: themesData } =
    themeIdsForApps.length > 0
      ? await supabase
          .from("themes")
          .select("id, title")
          .in("id", themeIdsForApps)
      : { data: [] as { id: string; title: string }[] };

  const themeById = new Map((themesData ?? []).map((t) => [t.id, t]));

  // TeamsBoard 用にネスト
  const teamMembersByTeam = new Map<
    string,
    { user_id: string; role: "lead" | "member"; joined_at: string }[]
  >();
  for (const tm of teamMembersData ?? []) {
    const arr = teamMembersByTeam.get(tm.team_id) ?? [];
    arr.push({ user_id: tm.user_id, role: tm.role, joined_at: tm.joined_at });
    teamMembersByTeam.set(tm.team_id, arr);
  }

  const appsByTeam = new Map<
    string,
    {
      id: string;
      theme_id: string;
      theme_title: string;
      preference_rank: number | null;
      status: string;
    }[]
  >();
  for (const a of appsData ?? []) {
    if (!a.team_id) continue;
    const arr = appsByTeam.get(a.team_id) ?? [];
    arr.push({
      id: a.id,
      theme_id: a.theme_id,
      theme_title: themeById.get(a.theme_id)?.title ?? "(削除されたテーマ)",
      preference_rank: a.preference_rank,
      status: a.status,
    });
    appsByTeam.set(a.team_id, arr);
  }

  // pending 招待 (このユーザ宛て + 組織内のチームからの outbound の両方を扱う)
  const { data: invitesData } =
    teamIds.length > 0
      ? await supabase
          .from("team_invitations")
          .select(
            "id, team_id, invited_user_id, invited_by, status, created_at",
          )
          .in("team_id", teamIds)
          .eq("status", "pending")
      : {
          data: [] as {
            id: string;
            team_id: string;
            invited_user_id: string;
            invited_by: string;
            status: string;
            created_at: string;
          }[],
        };

  const invitesByTeam = new Map<
    string,
    {
      id: string;
      invited_user_id: string;
      invited_by: string;
      created_at: string;
    }[]
  >();
  for (const iv of invitesData ?? []) {
    const arr = invitesByTeam.get(iv.team_id) ?? [];
    arr.push({
      id: iv.id,
      invited_user_id: iv.invited_user_id,
      invited_by: iv.invited_by,
      created_at: iv.created_at,
    });
    invitesByTeam.set(iv.team_id, arr);
  }

  // 招待関連 profile を追加取得 (未読 profileById に無いユーザ)
  const inviteUserIds = Array.from(
    new Set(
      (invitesData ?? []).flatMap((i) => [i.invited_user_id, i.invited_by]),
    ),
  );
  const missingInviteUserIds = inviteUserIds.filter(
    (id) => !profileById.has(id),
  );
  if (missingInviteUserIds.length > 0) {
    const { data: extraProfs } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", missingInviteUserIds);
    for (const p of extraProfs ?? []) profileById.set(p.id, p);
  }

  const teamById = new Map(teams.map((t) => [t.id, t]));

  const teamsForBoard = teams.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    created_by: t.created_by,
    created_at: t.created_at,
    members: (teamMembersByTeam.get(t.id) ?? []).map((tm) => {
      const prof = profileById.get(tm.user_id);
      return {
        user_id: tm.user_id,
        role: tm.role,
        display_name: prof?.display_name ?? null,
        avatar_url: prof?.avatar_url ?? null,
      };
    }),
    applications: (appsByTeam.get(t.id) ?? []).sort((a, b) => {
      const ra = a.preference_rank ?? 99;
      const rb = b.preference_rank ?? 99;
      return ra - rb;
    }),
    pendingInvites: (invitesByTeam.get(t.id) ?? []).map((iv) => {
      const prof = profileById.get(iv.invited_user_id);
      return {
        id: iv.id,
        invited_user_id: iv.invited_user_id,
        display_name: prof?.display_name ?? null,
      };
    }),
  }));

  // 自分宛ての pending 招待 (別セクションで受諾/辞退)
  const myInbox = (invitesData ?? [])
    .filter((iv) => iv.invited_user_id === user.id)
    .map((iv) => {
      const team = teamById.get(iv.team_id);
      const inviterProf = profileById.get(iv.invited_by);
      return {
        id: iv.id,
        team_id: iv.team_id,
        team_name: team?.name ?? "(削除されたチーム)",
        invited_by_name: inviterProf?.display_name ?? "(不明)",
        created_at: iv.created_at,
      };
    });

  // 自分の所属チーム (in 組織)
  const myTeamId =
    (teamMembersData ?? []).find((tm) => tm.user_id === user.id)?.team_id ??
    null;
  const myTeamRole =
    (teamMembersData ?? []).find((tm) => tm.user_id === user.id)?.role ??
    null;

  // 未所属メンバー (どのチームにも入っていない人 = 招待 pending 者もここに含まれる)
  const affiliatedUserIds = new Set(
    (teamMembersData ?? []).map((tm) => tm.user_id),
  );
  // 招待 pending 中の user_id を自分のチーム宛てに限定して集計
  const pendingInvitedByMyTeam = new Set<string>(
    myTeamId
      ? (invitesData ?? [])
          .filter((iv) => iv.team_id === myTeamId)
          .map((iv) => iv.invited_user_id)
      : [],
  );
  const unaffiliated = orgMembers.filter(
    (m) => !affiliatedUserIds.has(m.user_id),
  );

  if (!org.competition_enabled) {
    return (
      <GlassCard className="p-8 text-center flex flex-col gap-3">
        <span aria-hidden className="text-3xl">
          🔒
        </span>
        <h1 className="text-[18px] font-extrabold">
          この組織では「チーム組成」を利用できません
        </h1>
        <p className="t-cap">
          チーム組成機能はテーマ応募機能 (competition mode) を有効にした組織のみ利用できます。
        </p>
      </GlassCard>
    );
  }

  return (
    <TeamsBoard
      orgSlug={orgSlug}
      orgId={org.id}
      orgName={org.name}
      currentUserId={user.id}
      isAdmin={isAdmin}
      teams={teamsForBoard}
      orgMembers={orgMembers}
      unaffiliated={unaffiliated}
      pendingInvitedUserIds={Array.from(pendingInvitedByMyTeam)}
      myTeamId={myTeamId}
      myTeamRole={myTeamRole}
      myInbox={myInbox}
    />
  );
}
