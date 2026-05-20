import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { listUserOrgs } from "@/lib/orgs";
import { listOrgProjects } from "@/lib/projects";
import { HeaderWithTab } from "@/components/shell/HeaderWithTab";
import { OrgRail } from "@/components/shell/OrgRail";
import { ProjectPane } from "@/components/shell/ProjectPane";
import { FloatingAI } from "@/components/ui/FloatingAI";
import { NavProgress } from "@/components/ui/NavProgress";
import { ViewAsBanner } from "@/components/shell/ViewAsBanner";

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
  if (!matched) notFound();

  const isAdmin = matched.role === "owner" || matched.role === "admin";
  const isThemeOwner = matched.role === "theme_owner";
  const competitionEnabled = matched.competition_enabled;
  const user = userResp.data.user;

  // プロジェクトアクセス & 一覧 (Header のチップ用)
  let hasProjectAccess = false;
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

  // 組織ナビ (左端) は常に表示。プロジェクトパネルは現在 org のプロジェクトが
  // 1件以上ある (またはオーナー/管理者で「＋ 新規プロジェクト」を出すべき) 時。
  const showProjectPane =
    effectiveHasAccess || effectiveIsAdmin;
  const showOrgRail = orgs.length > 0;
  // 左サイドバー幅: OrgRail 68 + ProjectPane 240 = 308
  const leftReserve = showOrgRail
    ? showProjectPane
      ? "md:pl-[308px]"
      : "md:pl-[68px]"
    : "";

  // ユーザイニシャル (Org rail のメニュー用)
  const email = user?.email ?? "";
  const userInitial = (email[0] ?? "?").toUpperCase();

  return (
    <>
      {showOrgRail && (
        <OrgRail
          activeSlug={orgSlug}
          orgs={orgs.map((o) => ({
            id: o.id,
            name: o.name,
            slug: o.slug,
            emoji: o.emoji,
            icon_url: o.icon_url,
            role: o.role,
          }))}
          userInitial={userInitial}
          isAdmin={effectiveIsAdmin}
        />
      )}
      {showOrgRail && showProjectPane && (
        <ProjectPane
          orgSlug={orgSlug}
          orgName={matched.name}
          orgEmoji={matched.emoji ?? null}
          orgIconUrl={matched.icon_url ?? null}
          projects={projectsForHeader}
          fallbackProjectId={validFallback}
          canCreate={effectiveIsAdmin}
        />
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
          projects={projectsForHeader}
          fallbackProjectId={validFallback}
        />
        {(previewAsMember || previewAsThemeOwner) && (
          <ViewAsBanner mode={previewAsThemeOwner ? "theme_owner" : "member"} />
        )}
        <main className="py-6 md:py-7 max-w-[1400px] mx-auto px-6 md:px-7">
          {children}
        </main>
      </div>
      <FloatingAI />
      <NavProgress />
    </>
  );
}
