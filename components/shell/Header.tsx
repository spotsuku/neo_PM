import Link from "next/link";

import { TabPill } from "@/components/ui/TabPill";
import { OrgSwitcher } from "@/components/shell/OrgSwitcher";
import { HeaderProjectChip } from "@/components/shell/HeaderProjectChip";
import type { listUserOrgs } from "@/lib/orgs";

type Org = Awaited<ReturnType<typeof listUserOrgs>>[number];

export interface HeaderProjectInfo {
  id: string;
  name: string;
  team_name: string | null;
  status: "active" | "paused" | "completed" | "archived";
  access: "manage" | "view" | "none";
}

export interface HeaderProps {
  orgSlug: string;
  orgs: Org[];
  activeTab: TabKey;
  hasProjectAccess: boolean;
  isAdmin: boolean;
  isThemeOwner: boolean;
  competitionEnabled: boolean;
  /** いま選択中のプロジェクト (URL ?p= で決まる) */
  currentProjectId: string | null;
  /** プロジェクトチップに出すアクセス可能な PJT 一覧 */
  projects: HeaderProjectInfo[];
}

export type TabKey =
  | "home"
  | "dash"
  | "plan"
  | "wbs"
  | "meetings"
  | "budget"
  | "diag"
  | "fund"
  | "ai"
  | "theme"
  | "themes";

type Visibility =
  | "always"
  | "project"
  | "admin"
  | "theme_admin"
  | "competition"
  | "competition_admin";

const TABS: {
  key: TabKey;
  emo: string;
  label: string;
  path: string;
  visibility: Visibility;
  /** タブが「プロジェクト依存」か (= ?p= を URL に引き継ぐべきか) */
  projectScoped: boolean;
}[] = [
  { key: "home",     emo: "🏠", label: "ホーム",     path: "",           visibility: "always",            projectScoped: false },
  { key: "themes",   emo: "🎯", label: "テーマ応募", path: "/themes",    visibility: "competition",       projectScoped: false },
  { key: "dash",     emo: "🚀", label: "ダッシュ",   path: "/dashboard", visibility: "project",           projectScoped: true  },
  { key: "plan",     emo: "🎯", label: "実行計画",   path: "/plan",      visibility: "project",           projectScoped: true  },
  { key: "wbs",      emo: "📋", label: "WBS",        path: "/wbs",       visibility: "project",           projectScoped: true  },
  { key: "meetings", emo: "📅", label: "会議",       path: "/meetings",  visibility: "project",           projectScoped: true  },
  { key: "budget",   emo: "💴", label: "収支",       path: "/budget",    visibility: "project",           projectScoped: true  },
  { key: "diag",     emo: "🔍", label: "チーム評価", path: "/diag",      visibility: "project",           projectScoped: true  },
  { key: "fund",     emo: "📨", label: "基金申請",   path: "/fund",      visibility: "project",           projectScoped: true  },
  { key: "ai",       emo: "✨", label: "AI伴走",     path: "/ai",        visibility: "project",           projectScoped: true  },
  { key: "theme",    emo: "📣", label: "テーマ出題", path: "/theme",     visibility: "competition_admin", projectScoped: false },
];

export function Header({
  orgSlug,
  orgs,
  activeTab,
  hasProjectAccess,
  isAdmin,
  isThemeOwner,
  competitionEnabled,
  currentProjectId,
  projects,
}: HeaderProps) {
  const base = `/${orgSlug}`;

  const visibleTabs = TABS.filter((t) => {
    if (t.visibility === "always") return true;
    if (t.visibility === "project") return hasProjectAccess;
    if (t.visibility === "admin") return isAdmin;
    if (t.visibility === "theme_admin") return isAdmin || isThemeOwner;
    if (t.visibility === "competition") return competitionEnabled;
    if (t.visibility === "competition_admin")
      return competitionEnabled && (isAdmin || isThemeOwner);
    return false;
  });

  const tabHref = (path: string, projectScoped: boolean) => {
    const href = `${base}${path}`;
    if (projectScoped && currentProjectId) {
      return `${href}?p=${currentProjectId}`;
    }
    return href;
  };

  return (
    <header className="glass-strong sticky top-0 z-30 flex h-[74px] items-center justify-between gap-4 px-6">
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href={`${base}`}
          className="grid h-8 w-8 place-items-center rounded-xl text-white font-extrabold"
          style={{
            background:
              "conic-gradient(from 220deg, var(--c-accent), var(--c-accent-deep) 60%, #0a0a0a)",
          }}
          aria-label="ホームへ"
        >
          ✦
        </Link>
        <div className="hidden sm:flex flex-col">
          <span className="text-[13px] font-bold tracking-tight">NEO PM</span>
          <span className="t-cap leading-none">応援資本主義のための PM</span>
        </div>
      </div>

      <nav className="flex flex-1 items-center justify-center gap-1.5 overflow-x-auto px-2">
        {visibleTabs.map((t) => (
          <TabPill
            key={t.key}
            href={tabHref(t.path, t.projectScoped)}
            emo={t.emo}
            label={t.label}
            active={activeTab === t.key}
          />
        ))}
      </nav>

      <div className="flex items-center gap-2">
        {hasProjectAccess && (
          <HeaderProjectChip
            orgSlug={orgSlug}
            projects={projects}
            currentProjectId={currentProjectId}
          />
        )}
        <span
          className="hidden xl:inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold text-[--c-accent-deep]"
          data-c-fun="playful"
        >
          🔥 21日連続
        </span>
        <OrgSwitcher activeSlug={orgSlug} orgs={orgs} />
      </div>
    </header>
  );
}
