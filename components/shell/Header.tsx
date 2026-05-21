import { TabPill } from "@/components/ui/TabPill";
import { ScrollableNav } from "@/components/shell/ScrollableNav";
import { CompetitionUpgradeChip } from "@/components/shell/CompetitionUpgradeChip";
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
  orgId: string;
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
  { key: "diag",     emo: "🏢", label: "チーム管理", path: "/diag",      visibility: "project",           projectScoped: true  },
  { key: "fund",     emo: "📨", label: "基金申請",   path: "/fund",      visibility: "project",           projectScoped: true  },
  { key: "ai",       emo: "✨", label: "AI伴走",     path: "/ai",        visibility: "project",           projectScoped: true  },
  { key: "theme",    emo: "📣", label: "テーマ出題", path: "/theme",     visibility: "competition_admin", projectScoped: false },
];

export function Header({
  orgSlug,
  orgId,
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
    if (projectScoped && currentProjectId) {
      // /<orgSlug>/projects/<projectId>/<feature> (path に projectId を埋め込む)
      return `${base}/projects/${currentProjectId}${path}`;
    }
    return `${base}${path}`;
  };

  // orgs はタブ生成のためだけに使用 (将来の活用に備えて props は残す)
  void orgs;

  // テーマ応募 / テーマ出題 はコンペティション有効組織のみ。右端に寄せる。
  const competitionKeys: TabKey[] = ["themes", "theme"];
  const mainTabs = visibleTabs.filter((t) => !competitionKeys.includes(t.key));
  const compTabs = visibleTabs.filter((t) => competitionKeys.includes(t.key));

  return (
    <header
      className="glass-strong sticky top-0 z-20 flex h-[74px] items-center justify-between gap-2 px-6"
      data-tour="header-tabs"
    >
      <ScrollableNav>
        {mainTabs.map((t) => (
          <TabPill
            key={t.key}
            href={tabHref(t.path, t.projectScoped)}
            emo={t.emo}
            label={t.label}
            active={activeTab === t.key}
          />
        ))}
      </ScrollableNav>

      {compTabs.length > 0 && (
        <ScrollableNav variant="comp">
          {compTabs.map((t) => (
            <TabPill
              key={t.key}
              href={tabHref(t.path, t.projectScoped)}
              emo={t.emo}
              label={t.label}
              active={activeTab === t.key}
            />
          ))}
        </ScrollableNav>
      )}

      <div className="flex items-center gap-2 flex-shrink-0">
        {!competitionEnabled && isAdmin && (
          <CompetitionUpgradeChip orgId={orgId} orgSlug={orgSlug} />
        )}
        <span
          className="hidden xl:inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold text-[--c-accent-deep]"
          data-c-fun="playful"
        >
          🔥 21日連続
        </span>
      </div>
    </header>
  );
}
