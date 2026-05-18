"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface HeaderProject {
  id: string;
  name: string;
  team_name: string | null;
  status: "active" | "paused" | "completed" | "archived";
  access: "manage" | "view" | "none";
}

interface Props {
  orgSlug: string;
  projects: HeaderProject[];
  currentProjectId: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  active: "進行中",
  paused: "休止",
  completed: "完了",
  archived: "アーカイブ",
};

const STATUS_BG: Record<string, string> = {
  active: "var(--ok)",
  paused: "var(--warn)",
  completed: "var(--c-accent)",
  archived: "var(--mute)",
};

/** ヘッダーに置く「いまどのプロジェクトにいるか」表示 + 切替ピッカー。
 *  クリックでドロップダウンを開き、別 PJT を選ぶと現在の URL に
 *  ?p=<projectId> を付け替えて遷移する。 */
export function HeaderProjectChip({
  orgSlug,
  projects,
  currentProjectId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? `/${orgSlug}`;
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // 外クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // 表示候補: アクセス可能なもの。currentProjectId が "none" でも残す
  const visible = projects.filter(
    (p) => p.access !== "none" || p.id === currentProjectId,
  );
  if (visible.length === 0) return null;

  const current = visible.find((p) => p.id === currentProjectId) ?? null;

  const switchTo = (id: string) => {
    const params = new URLSearchParams(search?.toString() ?? "");
    params.set("p", id);
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition shadow-[0_1px_0_var(--line-soft)] " +
          (current
            ? "bg-accent-soft text-[--c-accent-deep]"
            : "bg-white text-mute hover:bg-mute/5")
        }
        title="プロジェクト切替"
      >
        <span aria-hidden>🚀</span>
        <span className="truncate max-w-[180px]">
          {current ? current.name : "プロジェクトを選択"}
        </span>
        <span aria-hidden className="opacity-60">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-line bg-white p-2 shadow-[0_18px_60px_-20px_rgba(20,30,80,.25)]"
        >
          <div className="t-label px-2 pt-1 pb-2">プロジェクトを切替</div>
          <div className="flex flex-col gap-0.5 max-h-[60vh] overflow-y-auto">
            {visible.map((p) => {
              const active = p.id === currentProjectId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => switchTo(p.id)}
                  disabled={p.access === "none"}
                  className={
                    "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] " +
                    (active
                      ? "bg-accent-soft text-[--c-accent-deep] font-semibold"
                      : "text-ink-2 hover:bg-mute/5") +
                    (p.access === "none"
                      ? " opacity-50 cursor-not-allowed"
                      : "")
                  }
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ background: STATUS_BG[p.status] }}
                    title={STATUS_LABEL[p.status]}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{p.name}</span>
                    {p.team_name && (
                      <span className="block t-cap opacity-70 truncate">
                        {p.team_name}
                      </span>
                    )}
                  </span>
                  {active && <span className="t-cap">いま</span>}
                  {p.access === "none" && (
                    <span className="t-cap">🔒</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
