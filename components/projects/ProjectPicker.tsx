"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface Item {
  id: string;
  name: string;
  team_name: string | null;
  status: string;
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
  const current = projects.find((p) => p.id === currentId) ?? projects[0];

  const select = (id: string) => {
    const params = new URLSearchParams(search?.toString() ?? "");
    params.set("p", id);
    router.push(`?${params.toString()}`);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-semibold text-ink shadow-[0_1px_0_var(--line-soft)] hover:bg-mute/5"
      >
        <span aria-hidden>📁</span>
        <span className="truncate max-w-[160px]">{current?.name ?? "プロジェクト"}</span>
        <span aria-hidden>▾</span>
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-line bg-white p-2 shadow-[0_18px_60px_-20px_rgba(20,30,80,.25)]">
            <div className="t-label px-2 pt-1 pb-2">プロジェクトを切替</div>
            <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto">
              {projects.map((p) => (
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
            >
              ＋ 新しいプロジェクト
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
