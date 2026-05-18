"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";

interface SidebarProject {
  id: string;
  name: string;
  team_name: string | null;
  status: "active" | "paused" | "completed" | "archived";
  access: "manage" | "view" | "none";
  thumbnail_url?: string | null;
  is_demo?: boolean;
}

interface Props {
  orgSlug: string;
  projects: SidebarProject[];
  /** URL に ?p= がない時の fallback (cookie ベース) */
  fallbackProjectId: string | null;
  canCreate: boolean;
}

const STATUS_DOT: Record<string, string> = {
  active: "var(--ok)",
  paused: "var(--warn)",
  completed: "var(--c-accent)",
  archived: "var(--mute)",
};

/** Slack 風の細い左サイドバー。プロジェクト切替専用。
 *  - 縦並びでサムネ + 「いま」インジケータ
 *  - クリックで現在の path (URL pathname) を維持して ?p=<id> を切替
 *  - 各サムネにツールチップ (title) で名前
 */
export function ProjectSidebar({
  orgSlug,
  projects,
  fallbackProjectId,
  canCreate,
}: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? `/${orgSlug}`;
  const search = useSearchParams();
  const explicit = search?.get("p") ?? null;
  const currentProjectId = explicit ?? fallbackProjectId ?? null;

  const visible = projects.filter((p) => p.access !== "none");
  if (visible.length < 2) return null;

  const onProjectPage = /\/(dashboard|plan|wbs|meetings|budget|diag|fund|ai)(\/|\?|$)/.test(
    pathname,
  );

  const switchTo = (id: string) => {
    if (id === currentProjectId) return;
    // プロジェクトページ上なら同じパスに ?p= だけ切替、それ以外は dashboard へ
    const target = onProjectPage ? pathname : `/${orgSlug}/dashboard`;
    const params = new URLSearchParams(search?.toString() ?? "");
    params.set("p", id);
    router.push(`${target}?${params.toString()}`);
  };

  return (
    <aside
      className="hidden md:flex fixed left-0 top-[74px] bottom-0 z-20 w-[72px] flex-col items-center gap-1.5 py-3 border-r border-line-soft bg-white/60 backdrop-blur"
      aria-label="プロジェクトサイドバー"
    >
      <div className="t-cap mb-1 px-1 text-center leading-tight">
        Project
      </div>
      <div className="flex-1 overflow-y-auto w-full flex flex-col items-center gap-1.5 px-1">
        {visible.map((p) => {
          const active = p.id === currentProjectId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => switchTo(p.id)}
              className="relative group w-full grid place-items-center py-1"
              title={`${p.name}${p.team_name ? ` (${p.team_name})` : ""}`}
            >
              {/* active 左バー */}
              <span
                className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full transition-all"
                style={{
                  background: active ? "var(--c-accent)" : "transparent",
                  transform: active ? "scaleY(1)" : "scaleY(0.4)",
                }}
                aria-hidden
              />
              {/* サムネ */}
              <span
                className="relative inline-grid place-items-center w-12 h-12 rounded-2xl overflow-hidden text-white font-bold transition"
                style={{
                  background: p.thumbnail_url
                    ? `url(${p.thumbnail_url}) center / cover`
                    : "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
                  outline: active
                    ? "2px solid var(--c-accent)"
                    : "1px solid var(--line-soft)",
                  outlineOffset: active ? 2 : 0,
                  transform: active ? "scale(1.02)" : undefined,
                }}
              >
                {!p.thumbnail_url && (p.name[0] ?? "?")}
                {/* ステータスドット (active 以外も) */}
                <span
                  className="absolute -bottom-0.5 -right-0.5 inline-block w-2.5 h-2.5 rounded-full ring-2 ring-white"
                  style={{ background: STATUS_DOT[p.status] }}
                  aria-hidden
                />
                {p.is_demo && (
                  <span
                    className="absolute top-0 left-0 text-[8px] font-bold px-1 rounded-br-md bg-warn text-white"
                    aria-hidden
                  >
                    見本
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {canCreate && (
        <Link
          href={`/${orgSlug}/projects/new`}
          className="grid place-items-center w-12 h-12 rounded-2xl text-mute hover:text-ink hover:bg-mute/5 border border-dashed border-line transition mb-1"
          title="新規プロジェクト"
        >
          <span className="text-xl">＋</span>
        </Link>
      )}
    </aside>
  );
}
