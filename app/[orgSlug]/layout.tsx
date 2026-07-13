import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { listUserOrgs } from "@/lib/orgs";
import { listOrgProjects } from "@/lib/projects";
import { HeaderWithTab } from "@/components/shell/HeaderWithTab";
import { OrgRail } from "@/components/shell/OrgRail";
import { ProjectPane } from "@/components/shell/ProjectPane";
import { MobileNav } from "@/components/shell/MobileNav";
import { FloatingAI } from "@/components/ui/FloatingAI";
import { NavProgress } from "@/components/ui/NavProgress";
import { ViewAsBanner } from "@/components/shell/ViewAsBanner";
import { FreeTierBanner } from "@/components/shell/FreeTierBanner";
import { TutorialHost } from "@/components/tutorial/TutorialHost";

const LAST_PROJECT_COOKIE = "neo:last-project-id";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createClient();

  // 並列実行: orgs / 現在ユーザ / cookie
  const [orgs, userResp, cookieStore] = await Promise.all([
    listUserOrgs(supabase),
    supabase.auth.getUser(),
    cookies(),
  ]);

  const matched = orgs.find((o) => o.slug === orgSlug);
  if (!matched) {
    // community_dashboard で認証済みで、この org が招待対象なら
    // /orgs に戻して「参加できる」カードを見せる (404 を回避)
    const user = userResp.data.user;
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    if (
      user &&
      meta.community_verified === true &&
      meta.community_invited_org_slug === orgSlug
    ) {
      redirect("/orgs");
    }
    notFound();
  }

  // cohort (期) 制限 (多層防御): NEO_COMMUNITY_REQUIRED_COHORT_ID が設定されていて、
  // この org が制限対象 slug (NEO_COMMUNITY_ORG_SLUG) の場合、ログイン時に判定した
  // community_cohort_ok を必須にする。既に membership があっても対象期でなければ締め出す。
  const requiredCohortId = process.env.NEO_COMMUNITY_REQUIRED_COHORT_ID?.trim();
  const cohortGatedSlug = process.env.NEO_COMMUNITY_ORG_SLUG?.trim();
  if (requiredCohortId && orgSlug === cohortGatedSlug) {
    const meta = (userResp.data.user?.user_metadata ?? {}) as Record<
      string,
      unknown
    >;
    if (meta.community_cohort_ok !== true) {
      notFound();
    }
  }

  const isAdmin = matched.role === "owner" || matched.role === "admin";
  const isThemeOwner = matched.role === "theme_owner";
  const competitionEnabled = matched.competition_enabled;
  const user = userResp.data.user;

  // プロジェクトアクセス & 一覧 (Header のチップ用)
  let hasProjectAccess = false;
  // 上部バーのプロジェクト名ラベル用 (未参加プロジェクトの名前も引けるよう全件)
  const projectNameById: Record<string, string> = {};
  const projectsForHeader: {
    id: string;
    name: string;
    team_name: string | null;
    status: "active" | "paused" | "completed" | "archived";
    access: "manage" | "view" | "none";
    thumbnail_url: string | null;
    is_demo: boolean;
  }[] = [];
  if (user) {
    const allProjects = await listOrgProjects(supabase, matched.id);
    for (const p of allProjects) {
      projectNameById[p.id] = p.team_name ?? p.name;
    }
    const accessible = allProjects.filter((p) => p.access !== "none");
    hasProjectAccess = accessible.length > 0;
    // 並び順: アクティブ優先 + updated_at desc
    projectsForHeader.push(
      ...accessible
        .slice()
        .sort((a, b) => {
          const sa = a.status === "active" ? 0 : 1;
          const sb = b.status === "active" ? 0 : 1;
          if (sa !== sb) return sa - sb;
          return b.updated_at.localeCompare(a.updated_at);
        })
        .map((p) => ({
          id: p.id,
          name: p.name,
          team_name: p.team_name,
          status: p.status,
          access: p.access,
          thumbnail_url: p.thumbnail_url,
          is_demo: p.is_demo,
        })),
    );
  }

  // 管理者用「メンバー / テーマオーナー視点プレビュー」cookie
  const viewAs = cookieStore.get("neo:view-as")?.value;
  const previewAsMember = isAdmin && viewAs === "member";
  const previewAsThemeOwner = isAdmin && viewAs === "theme_owner";

  // 直前に閲覧していたプロジェクト (cookie) — URL に ?p= が無いときの
  // フォールバック。 cookie key は org ごと: neo:last-project-id:<slug>
  const lastProjectCookie = cookieStore.get(
    `${LAST_PROJECT_COOKIE}:${orgSlug}`,
  )?.value;
  const validFallback =
    lastProjectCookie &&
    projectsForHeader.some((p) => p.id === lastProjectCookie)
      ? lastProjectCookie
      : (projectsForHeader[0]?.id ?? null);

  // メンバー視点プレビュー中でも、実際にプロジェクトに参加していれば
  // プロジェクト系タブは見える (= メンバーとして当然のアクセス)。
  // 管理者 / テーマオーナーのフラグだけを下げる。
  const effectiveHasAccess = hasProjectAccess;
  const effectiveIsAdmin =
    previewAsMember || previewAsThemeOwner ? false : isAdmin;
  const effectiveIsThemeOwner = previewAsThemeOwner
    ? true
    : previewAsMember
      ? false
      : isThemeOwner;

  // 組織ナビ (左端) は常に表示。
  // プロジェクトパネルは「組織内ナビ」(ホーム/テーマ + プロジェクト一覧) を兼ねる
  // ようになったため、組織に属している限り常に表示する。
  const showOrgRail = orgs.length > 0;
  const showProjectPane = showOrgRail;
  // 左サイドバー幅: OrgRail 68 + ProjectPane 240 = 308
  const leftReserve = showOrgRail
    ? showProjectPane
      ? "md:pl-[308px]"
      : "md:pl-[68px]"
    : "";

  // ユーザイニシャル (Org rail のメニュー用)
  const email = user?.email ?? "";
  const userInitial = (email[0] ?? "?").toUpperCase();

  // 無料公開中バナーの組織別非表示フラグ (migration 0039)。
  // 列が無い環境では false (= バナー表示) を安全側の既定とする。
  const { data: orgBanner } = await supabase
    .from("organizations")
    .select("hide_free_tier_banner")
    .eq("id", matched.id)
    .maybeSingle();
  const hideFreeTierBanner = orgBanner?.hide_free_tier_banner ?? false;

  // 資金調達(課金機能)の有効フラグ (migration 0043)。列が無い環境では false。
  const { data: orgFund } = await supabase
    .from("organizations")
    .select("fundraising_enabled")
    .eq("id", matched.id)
    .maybeSingle();
  const fundraisingEnabled = orgFund?.fundraising_enabled ?? false;

  // 初回オンボーディングツアー状態 (migration 0037 未適用環境でも落ちないよう
  // try/catch + 結果の有無で判定)
  let tutorialAutoOpen = false;
  if (user) {
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("tutorial_completed_at")
        .eq("id", user.id)
        .maybeSingle();
      tutorialAutoOpen = !prof?.tutorial_completed_at;
    } catch {
      // 列が無ければ tutorial 機能オフ扱い (= 自動オープンしない)
      tutorialAutoOpen = false;
    }
  }

  // OrgRail / ProjectPane はデスクトップ固定サイドバーとモバイルドロワーで
  // 同じ内容を使い回すため、props をここで一度だけ組み立てる。
  const railOrgs = orgs.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    emoji: o.emoji,
    icon_url: o.icon_url,
    icon_zoom: o.icon_zoom,
    icon_offset_x: o.icon_offset_x,
    icon_offset_y: o.icon_offset_y,
    role: o.role,
  }));
  const projectPaneProps = {
    orgSlug,
    orgName: matched.name,
    orgEmoji: matched.emoji ?? null,
    orgIconUrl: matched.icon_url ?? null,
    orgIconZoom: matched.icon_zoom ?? 1,
    orgIconOffsetX: matched.icon_offset_x ?? 0,
    orgIconOffsetY: matched.icon_offset_y ?? 0,
    projects: projectsForHeader,
    fallbackProjectId: validFallback,
    canCreate: effectiveIsAdmin || effectiveIsThemeOwner,
    // 組織内ナビ (ホーム / テーマ応募 / テーマ出題) の出し分け用
    competitionEnabled,
    isAdmin: effectiveIsAdmin,
    isThemeOwner: effectiveIsThemeOwner,
  };

  return (
    <>
      {/* デスクトップ (md以上): 左固定サイドバー */}
      {showOrgRail && (
        <OrgRail
          activeSlug={orgSlug}
          orgs={railOrgs}
          userInitial={userInitial}
          isAdmin={effectiveIsAdmin}
        />
      )}
      {showOrgRail && showProjectPane && (
        <ProjectPane {...projectPaneProps} />
      )}

      {/* モバイル (<md): ハンバーガー + ドロワー (同じ中身を流用) */}
      {showOrgRail && (
        <MobileNav>
          <OrgRail
            variant="drawer"
            activeSlug={orgSlug}
            orgs={railOrgs}
            userInitial={userInitial}
            isAdmin={effectiveIsAdmin}
          />
          {showProjectPane && <ProjectPane variant="drawer" {...projectPaneProps} />}
        </MobileNav>
      )}

      <div className={leftReserve}>
        <HeaderWithTab
          orgSlug={orgSlug}
          orgId={matched.id}
          orgs={orgs}
          hasProjectAccess={effectiveHasAccess}
          isAdmin={effectiveIsAdmin}
          isThemeOwner={effectiveIsThemeOwner}
          competitionEnabled={competitionEnabled}
          fundraisingEnabled={fundraisingEnabled}
          projects={projectsForHeader}
          fallbackProjectId={validFallback}
          projectNameById={projectNameById}
        />
        {(previewAsMember || previewAsThemeOwner) && (
          <ViewAsBanner mode={previewAsThemeOwner ? "theme_owner" : "member"} />
        )}
        {!hideFreeTierBanner && <FreeTierBanner />}
        <main className="py-6 md:py-7 max-w-[1400px] mx-auto px-6 md:px-7">
          {children}
        </main>
      </div>
      <FloatingAI />
      <NavProgress />
      {user && (
        <TutorialHost
          orgSlug={orgSlug}
          demoProjectId={
            projectsForHeader.find((p) => p.is_demo)?.id ?? null
          }
          autoOpen={tutorialAutoOpen}
        />
      )}
    </>
  );
}
