import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { listUserOrgs } from "@/lib/orgs";
import { listOrgProjects } from "@/lib/projects";
import { HeaderWithTab } from "@/components/shell/HeaderWithTab";
import { FloatingAI } from "@/components/ui/FloatingAI";
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

  const effectiveHasAccess =
    previewAsMember || previewAsThemeOwner ? false : hasProjectAccess;
  const effectiveIsAdmin =
    previewAsMember || previewAsThemeOwner ? false : isAdmin;
  const effectiveIsThemeOwner = previewAsThemeOwner
    ? true
    : previewAsMember
      ? false
      : isThemeOwner;

  return (
    <>
      <HeaderWithTab
        orgSlug={orgSlug}
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
      <main className="px-6 py-6 md:px-7 md:py-7 max-w-[1400px] mx-auto">
        {children}
      </main>
      <FloatingAI />
    </>
  );
}
