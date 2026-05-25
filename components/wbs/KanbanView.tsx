"use client";

import { useState } from "react";

import type { Task } from "@/components/wbs/WbsBoard";

interface Props {
  tasks: Task[];
  onSelect: (t: Task) => void;
  onMove: (id: string, status: Task["status"]) => void;
}

const COLUMNS: { key: Task["status"]; label: string; emo: string }[] = [
  { key: "todo", label: "未着手", emo: "📥" },
  { key: "doing", label: "進行中", emo: "⚙️" },
  { key: "review", label: "レビュー", emo: "🔎" },
  { key: "done", label: "完了", emo: "✅" },
];

const COLUMN_COLOR: Record<string, string> = {
  todo: "var(--mute)",
  doing: "var(--c-accent)",
  review: "var(--warn)",
  done: "var(--ok)",
};

export function KanbanView({ tasks, onSelect, onMove }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-4">
      {COLUMNS.map((col) => {
        const items = tasks.filter((t) => t.status === col.key);
        return (
          <div
            key={col.key}
            className="flex flex-col gap-2 rounded-xl bg-white/60 p-3 min-h-[200px]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragId) {
                onMove(dragId, col.key);
                setDragId(null);
              }
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span aria-hidden>{col.emo}</span>
                <span className="text-[12px] font-bold">{col.label}</span>
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                style={{ background: COLUMN_COLOR[col.key] }}
              >
                {items.length}
              </span>
            </div>
            {items.length === 0 ? (
              <div className="t-cap py-6 text-center opacity-60">
                ここにドロップ
              </div>
            ) : (
              items.map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={() => setDragId(t.id)}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => onSelect(t)}
                  className="rounded-lg bg-white border border-line-soft p-2.5 cursor-pointer hover:shadow-sm transition"
                >
                  <div className="text-[12.5px] font-semibold mb-1">
                    {t.title}
                  </div>
                  <div className="flex items-center justify-between t-cap">
                    <span>{t.owner_name ?? "-"}</span>
                    <span className="t-mono">{t.progress}%</span>
                  </div>
                  {t.tag && (
                    <span className="mt-1 inline-block rounded-full bg-accent-soft px-1.5 py-0.5 text-[9px] font-semibold text-[--c-accent-deep]">
                      {t.tag}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
