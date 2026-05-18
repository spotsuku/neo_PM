"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import type { ProjectAccess } from "@/lib/projects";

interface Item {
  id: string;
  name: string;
  team_name: string | null;
  status: string;
  access?: ProjectAccess;
}

export function ProjectPicker({
  orgSlug,
  projects,
  currentId,
}: {
  orgSlug: string;
  projects: Item[];
  currentId: string;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; right: number }>({
    top: 0,
    right: 0,
  });
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // アクセス可なプロジェクトだけ表示。currentId が none でもそれは含めて見せる。
  const visible = projects.filter(
    (p) => p.access !== "none" || p.id === currentId,
  );

  const current = visible.find((p) => p.id === currentId) ?? visible[0];

  const updateCoords = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setCoords({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    });
  };

  useEffect(() => {
    if (!open) return;
    updateCoords();
    const handler = () => updateCoords();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [open]);

  const select = (id: string) => {
    const params = new URLSearchParams(search?.toString() ?? "");
    params.set("p", id);
    router.push(`?${params.toString()}`);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-semibold text-ink shadow-[0_1px_0_var(--line-soft)] hover:bg-mute/5"
      >
        <span aria-hidden>📁</span>
        <span className="truncate max-w-[160px]">
          {current?.name ?? "プロジェクト"}
        </span>
        <span aria-hidden>▾</span>
      </button>
      {open &&
        mounted &&
        createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[60] cursor-default"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div
              role="menu"
              className="fixed z-[70] w-72 rounded-xl border border-line bg-white p-2 shadow-[0_18px_60px_-20px_rgba(20,30,80,.25)]"
              style={{ top: coords.top, right: coords.right }}
            >
              <div className="t-label px-2 pt-1 pb-2">プロジェクトを切替</div>
              <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto">
                {visible.length === 0 && (
                  <div className="t-cap text-center py-3">
                    アクセス可能なプロジェクトがありません
                  </div>
                )}
                {visible.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => select(p.id)}
                    className={
                      "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-accent-soft " +
                      (p.id === currentId
                        ? "bg-accent-soft text-[--c-accent-deep] font-semibold"
                        : "text-ink-2")
                    }
                  >
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="t-label">{p.status}</span>
                  </button>
                ))}
              </div>
              <div className="my-2 h-px bg-line" />
              <Link
                href={`/${orgSlug}/projects/new`}
                className="block rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-mute/5"
                onClick={() => setOpen(false)}
              >
                ＋ 新しいプロジェクト
              </Link>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
