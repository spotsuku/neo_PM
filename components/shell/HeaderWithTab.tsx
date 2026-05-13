"use client";

import { usePathname } from "next/navigation";

import { Header, type HeaderProps, type TabKey } from "@/components/shell/Header";

function detectTab(orgSlug: string, pathname: string): TabKey {
  const base = `/${orgSlug}`;
  if (pathname === base) return "home";
  const seg = pathname.replace(base, "").split("/").filter(Boolean)[0];
  const map: Record<string, TabKey> = {
    dashboard: "dash",
    plan: "plan",
    wbs: "wbs",
    budget: "budget",
    diag: "diag",
    fund: "fund",
    ai: "ai",
    theme: "theme",
  };
  return map[seg ?? ""] ?? "home";
}

export function HeaderWithTab({
  orgSlug,
  orgs,
}: Omit<HeaderProps, "activeTab">) {
  const pathname = usePathname() ?? `/${orgSlug}`;
  const activeTab = detectTab(orgSlug, pathname);
  return <Header orgSlug={orgSlug} orgs={orgs} activeTab={activeTab} />;
}
