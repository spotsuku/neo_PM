"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";

interface PaneProject {
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
  orgName: string;
  orgEmoji: string | null;
  orgIconUrl?: string | null;
  projects: PaneProject[];
  /** URL に ?p= がない時の fallback (cookie) */
  fallbackProjectId: string | null;
  canCreate: boolean;
}

const STATUS_DOT: Record<string, string> = {
  active: "#10b981",
  paused: "#f59e0b",
  completed: "var(--c-accent)",
  archived: "#94a3b8",
};

/** Slack のチャンネル一覧を踏襲した、組織内プロジェクト切替パネル。
 *  - ハッシュタグ風: # プロジェクト名
 *  - クリックで現在 path を維持しつつ ?p= を切替 (プロジェクトページ以外は dashboard へ)
 *  - 上部: 組織名 + 折り畳みヘッダー
 *  - 下部: ＋ 新規プロジェクト
 */
export function ProjectPane({
  orgSlug,
  orgName,
  orgEmoji,
  orgIconUrl,
  projects,
  fallbackProjectId,
  canCreate,
}: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? `/${orgSlug}`;
  const search = useSearchParams();
  const explicit = search?.get("p") ?? null;
  const currentProjectId = explicit ?? fallbackProjectId ?? null;
  const [q, setQ] = useState("");

  const visible = useMemo(
    () => projects.filter((p) => p.access !== "none"),
    [projects],
  );
  const filtered = useMemo(() => {
    const lower = q.trim().toLowerCase();
    if (!lower) return visible;
    return visible.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        (p.team_name ?? "").toLowerCase().includes(lower),
    );
  }, [visible, q]);

  const onProjectPage =
    /\/(dashboard|plan|wbs|meetings|budget|diag|fund|ai)(\/|\?|$)/.test(
      pathname,
    );

  const switchTo = (id: string) => {
    if (id === currentProjectId) return;
    const target = onProjectPage ? pathname : `/${orgSlug}/dashboard`;
    const params = new URLSearchParams(search?.toString() ?? "");
    params.set("p", id);
    router.push(`${target}?${params.toString()}`);
  };

  return (
    <aside
      className="hidden md:flex fixed left-[68px] top-0 bottom-0 z-30 w-[240px] flex-col border-r border-line-soft bg-white/95 backdrop-blur"
      aria-label="プロジェクトサイドバー"
    >
      {/* 組織ヘッダー */}
      <div className="px-3.5 py-3 border-b border-line-soft flex items-center gap-2">
        <span
          className="grid h-7 w-7 place-items-center rounded-lg text-white font-bold text-[12px] overflow-hidden"
          style={{
            background: orgIconUrl
              ? `url(${orgIconUrl}) center / cover`
              : "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
          }}
        >
          {!orgIconUrl && (orgEmoji?.trim() || orgName[0])}
        </span>
        <span
          className="text-[13.5px] font-extrabold tracking-tight text-ink truncate"
          title={orgName}
        >
          {orgName}
        </span>
      </div>

      {/* 検索 */}
      {visible.length >= 5 && (
        <div className="px-3 pt-2.5 pb-1">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="🔍 プロジェクトを検索"
            className="w-full rounded-md border border-line bg-white px-2.5 py-1 text-[11.5px] outline-none focus:border-[--c-accent]"
          />
        </div>
      )}

      {/* セクション見出し */}
      <div className="px-3.5 pt-3 pb-1 flex items-center justify-between">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-mute">
          プロジェクト
        </span>
        <span className="text-[10.5px] text-mute">{visible.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12px] text-mute">
            {q ? "一致するプロジェクトがありません" : "プロジェクトがまだありません"}
          </div>
        ) : (
          <ul className="flex flex-col gap-px">
            {filtered.map((p) => {
              const active = p.id === currentProjectId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => switchTo(p.id)}
                    className={
                      "group w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition " +
                      (active
                        ? "bg-[--c-accent] text-white"
                        : "text-ink-2 hover:bg-mute/10")
                    }
                    title={`${p.name}${p.team_name ? ` (${p.team_name})` : ""}`}
                  >
                    {/* サムネ or # */}
                    {p.thumbnail_url ? (
                      <span
                        className="grid h-6 w-6 place-items-center rounded-md overflow-hidden flex-shrink-0"
                        style={{
                          background: `url(${p.thumbnail_url}) center / cover`,
                        }}
                        aria-hidden
                      />
                    ) : (
                      <span
                        className={
                          "flex-shrink-0 grid h-6 w-6 place-items-center rounded-md text-[10px] font-bold " +
                          (active
                            ? "bg-white/20 text-white"
                            : "bg-mute/10 text-mute")
                        }
                        aria-hidden
                      >
                        #
                      </span>
                    )}
                    <span className="flex-1 min-w-0 text-[12.5px] font-semibold truncate">
                      {p.is_demo && (
                        <span
                          className="inline-block mr-1 text-[9px] font-bold align-middle"
                          aria-hidden
                        >
                          📌
                        </span>
                      )}
                      {p.name}
                    </span>
                    {/* ステータスドット */}
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: STATUS_DOT[p.status] }}
                      aria-hidden
                      title={p.status}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canCreate && (
        <div className="px-2.5 pb-3 pt-1 border-t border-line-soft">
          <Link
            href={`/${orgSlug}/projects/new`}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-semibold text-mute hover:text-ink hover:bg-mute/10 transition"
          >
            <span className="grid h-6 w-6 place-items-center rounded-md border border-dashed border-line text-mute">
              ＋
            </span>
            新規プロジェクト
          </Link>
        </div>
      )}
    </aside>
  );
}
