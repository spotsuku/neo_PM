"use client";

import { usePathname } from "next/navigation";

import { Header, type HeaderProps, type TabKey } from "@/components/shell/Header";

/** path から「現在のタブ」と「現在のプロジェクト ID」を抽出する。
 *
 *   /<org>                                 → home
 *   /<org>/themes  or /<org>/theme         → themes / theme
 *   /<org>/projects/<projectId>/<feature>  → feature タブ + projectId 抽出
 *   /<org>/<legacy-feature>?p=<id>         → 旧 URL (互換、現状 redirect で
 *      新形式に飛ぶので通常は到達しない)
 */
function detect(
  orgSlug: string,
  pathname: string,
): { tab: TabKey; projectId: string | null } {
  const base = `/${orgSlug}`;
  if (pathname === base) return { tab: "home", projectId: null };
  const trimmed = pathname.replace(base, "").replace(/^\/+/, "");
  const segs = trimmed.split("/").filter(Boolean);

  const featureMap: Record<string, TabKey> = {
    dashboard: "dash",
    plan: "plan",
    wbs: "wbs",
    meetings: "meetings",
    budget: "budget",
    diag: "diag",
    fund: "fund",
    ai: "ai",
    theme: "theme",
    themes: "themes",
  };

  // 新形式: projects/<projectId>/<feature>/...
  if (segs[0] === "projects" && segs[1]) {
    const projectId = segs[1];
    const feature = segs[2] ?? "";
    return { tab: featureMap[feature] ?? "home", projectId };
  }

  // 旧形式 (legacy): /<org>/<feature>
  return { tab: featureMap[segs[0] ?? ""] ?? "home", projectId: null };
}

export function HeaderWithTab({
  orgSlug,
  orgId,
  orgs,
  hasProjectAccess,
  isAdmin,
  isThemeOwner,
  competitionEnabled,
  projects,
  fallbackProjectId,
}: Omit<HeaderProps, "activeTab" | "currentProjectId"> & {
  fallbackProjectId: string | null;
}) {
  const pathname = usePathname() ?? `/${orgSlug}`;
  const { tab: activeTab, projectId: pathProjectId } = detect(orgSlug, pathname);
  // path に projectId があればそれが真。無い場合だけ fallback (cookie 由来) を使う。
  const currentProjectId = pathProjectId ?? fallbackProjectId ?? null;

  return (
    <Header
      orgSlug={orgSlug}
      orgId={orgId}
      orgs={orgs}
      activeTab={activeTab}
      hasProjectAccess={hasProjectAccess}
      isAdmin={isAdmin}
      isThemeOwner={isThemeOwner}
      competitionEnabled={competitionEnabled}
      currentProjectId={currentProjectId}
      projects={projects}
    />
  );
}
