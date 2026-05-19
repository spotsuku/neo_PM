"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { Header, type HeaderProps, type TabKey } from "@/components/shell/Header";

function detectTab(orgSlug: string, pathname: string): TabKey {
  const base = `/${orgSlug}`;
  if (pathname === base) return "home";
  const seg = pathname.replace(base, "").split("/").filter(Boolean)[0];
  const map: Record<string, TabKey> = {
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
  return map[seg ?? ""] ?? "home";
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
  const search = useSearchParams();
  const activeTab = detectTab(orgSlug, pathname);
  const explicit = search?.get("p") ?? null;
  const currentProjectId = explicit ?? fallbackProjectId ?? null;

  // ?p= で来たプロジェクト ID を Cookie に保存して次の遷移にも引き継ぐ
  useEffect(() => {
    if (!explicit) return;
    document.cookie = `neo:last-project-id:${orgSlug}=${explicit}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  }, [explicit, orgSlug]);

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
