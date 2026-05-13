import Link from "next/link";

import { TabPill } from "@/components/ui/TabPill";
import { OrgSwitcher } from "@/components/shell/OrgSwitcher";
import type { listUserOrgs } from "@/lib/orgs";

type Org = Awaited<ReturnType<typeof listUserOrgs>>[number];

export interface HeaderProps {
  orgSlug: string;
  orgs: Org[];
  activeTab: TabKey;
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
  | "theme";

const TABS: { key: TabKey; emo: string; label: string; path: string }[] = [
  { key: "home",     emo: "🏆", label: "ランキング", path: "" },
  { key: "dash",     emo: "🚀", label: "ダッシュ",   path: "/dashboard" },
  { key: "plan",     emo: "🎯", label: "実行計画",   path: "/plan" },
  { key: "wbs",      emo: "📋", label: "WBS",        path: "/wbs" },
  { key: "meetings", emo: "📅", label: "会議",       path: "/meetings" },
  { key: "budget",   emo: "💴", label: "収支",       path: "/budget" },
  { key: "diag",     emo: "🔍", label: "診断",       path: "/diag" },
  { key: "fund",     emo: "📨", label: "基金申請",   path: "/fund" },
  { key: "ai",       emo: "✨", label: "AI伴走",     path: "/ai" },
  { key: "theme",    emo: "📣", label: "テーマ出題", path: "/theme" },
];

export function Header({ orgSlug, orgs, activeTab }: HeaderProps) {
  const base = `/${orgSlug}`;
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
        {TABS.map((t) => (
          <TabPill
            key={t.key}
            href={`${base}${t.path}`}
            emo={t.emo}
            label={t.label}
            active={activeTab === t.key}
          />
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <span
          className="hidden sm:inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold text-[--c-accent-deep]"
          data-c-fun="playful"
        >
          🔥 21日連続
        </span>
        <OrgSwitcher activeSlug={orgSlug} orgs={orgs} />
      </div>
    </header>
  );
}
