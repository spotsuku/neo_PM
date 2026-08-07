import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { getDisplayName } from "@/lib/userDisplay";
import { ApplicationForm } from "@/components/themes/ApplicationForm";

export const dynamic = "force-dynamic";

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ orgSlug: string; themeId: string }>;
}) {
  const { orgSlug, themeId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/${orgSlug}/themes/${themeId}/apply`);

  // 並列実行: org / theme / 既存応募 / 自分のプロフィール
  const [org, themeResp, existingResp, profileResp] = await Promise.all([
    getOrgBySlug(supabase, orgSlug),
    supabase.from("themes").select("*").eq("id", themeId).maybeSingle(),
    supabase
      .from("theme_applications")
      .select("*")
      .eq("theme_id", themeId)
      .eq("applicant_user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
  ]);
  if (!org) notFound();
  const theme = themeResp.data;
  if (!theme) notFound();
  const existing = existingResp.data;

  // 自分が所属しているチームを取得 (掛け持ち禁止なので 0 or 1 件)
  // チーム名 + メンバー一覧を prefill 用に取得しておく。
  const { data: myTeamMemberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .eq("organization_id", org.id);

  const myTeamIds = (myTeamMemberships ?? []).map((tm) => tm.team_id);
  const myTeams: Array<{
    id: string;
    name: string;
    members: { user_id: string; display_name: string | null; role: "lead" | "member" }[];
  }> = [];
  if (myTeamIds.length > 0) {
    const [{ data: teamsData }, { data: allMembersData }] = await Promise.all([
      supabase
        .from("teams")
        .select("id, name")
        .in("id", myTeamIds)
        .eq("status", "active"),
      supabase
        .from("team_members")
        .select("team_id, user_id, role")
        .in("team_id", myTeamIds),
    ]);
    const memberUserIds = Array.from(
      new Set((allMembersData ?? []).map((tm) => tm.user_id)),
    );
    const { data: memberProfiles } =
      memberUserIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, display_name")
            .in("id", memberUserIds)
        : { data: [] as { id: string; display_name: string | null }[] };
    const nameById = new Map(
      (memberProfiles ?? []).map((p) => [p.id, p.display_name]),
    );
    for (const t of teamsData ?? []) {
      const members = (allMembersData ?? [])
        .filter((tm) => tm.team_id === t.id)
        .map((tm) => ({
          user_id: tm.user_id,
          display_name: nameById.get(tm.user_id) ?? null,
          role: tm.role,
        }))
        .sort((a, b) => (a.role === "lead" ? -1 : b.role === "lead" ? 1 : 0));
      myTeams.push({ id: t.id, name: t.name, members });
    }
  }

  // 採択済 + project_started_at が設定されているなら、応募者が
  // 既に project_memberships に居るかをチェック (居なければ「参加」ボタン表示)
  let applicantJoined = false;
  if (
    existing?.status === "approved" &&
    existing.created_project_id &&
    existing.project_started_at
  ) {
    const { data: pm } = await supabase
      .from("project_memberships")
      .select("user_id")
      .eq("project_id", existing.created_project_id)
      .eq("user_id", user.id)
      .maybeSingle();
    applicantJoined = Boolean(pm);
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <header>
        <Link
          href={`/${orgSlug}/themes/${themeId}`}
          className="t-cap underline"
        >
          ← テーマ詳細に戻る
        </Link>
        <h1 className="t-h2 mt-2">
          <span aria-hidden className="mr-2">
            ✦
          </span>
          応募申請: {theme.title}
        </h1>
        <p className="t-cap mt-1">
          チーム名・メンバー・提案内容を記入して応募してください
          {theme.company_name ? ` (主催: ${theme.company_name})` : ""}
        </p>
      </header>

      <ApplicationForm
        orgSlug={orgSlug}
        themeId={themeId}
        applicantUserId={user.id}
        applicantOrgId={org.id}
        initial={existing ?? null}
        applicantJoined={applicantJoined}
        defaultTeamName={getDisplayName(profileResp.data, user, "")}
        myTeams={myTeams}
      />
    </div>
  );
}
