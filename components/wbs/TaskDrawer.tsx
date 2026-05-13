"use client";

import { useEffect, useState } from "react";

import type { Task } from "@/components/wbs/WbsBoard";

interface Props {
  task: Task;
  onClose: () => void;
  onSave: (patch: Partial<Task>) => void;
  onDelete: () => void;
}

const TAGS = ["現場", "資料", "申請", "広報", "連携"];

export function TaskDrawer({ task, onClose, onSave, onDelete }: Props) {
  const [local, setLocal] = useState({
    title: task.title,
    owner_name: task.owner_name ?? "",
    start_week: task.start_week ?? 0,
    span_week: task.span_week ?? 1,
    progress: task.progress,
    status: task.status,
    tag: task.tag ?? "",
    is_milestone: task.is_milestone,
  });

  useEffect(() => {
    setLocal({
      title: task.title,
      owner_name: task.owner_name ?? "",
      start_week: task.start_week ?? 0,
      span_week: task.span_week ?? 1,
      progress: task.progress,
      status: task.status,
      tag: task.tag ?? "",
      is_milestone: task.is_milestone,
    });
  }, [task]);

  const commit = (patch: Partial<typeof local>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onSave({
      title: next.title,
      owner_name: next.owner_name || null,
      start_week: next.start_week,
      span_week: next.span_week,
      progress: Math.max(0, Math.min(100, next.progress)),
      status: next.status,
      tag: next.tag || null,
      is_milestone: next.is_milestone,
    });
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-ink/20"
        onClick={onClose}
        aria-label="閉じる"
      />
      <aside className="glass-strong fixed right-0 top-0 bottom-0 z-50 w-full max-w-md p-6 overflow-y-auto animate-risein">
        <div className="flex items-center justify-between mb-4">
          <span className="t-label">タスク編集</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-mute hover:bg-mute/10"
          >
            ✕
          </button>
        </div>

        <label className="block mb-3">
          <span className="t-label block mb-1">タイトル</span>
          <input
            type="text"
            value={local.title}
            onChange={(e) =>
              setLocal((s) => ({ ...s, title: e.target.value }))
            }
            onBlur={() => commit({})}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[--c-accent]"
          />
        </label>

        <label className="block mb-3">
          <span className="t-label block mb-1">担当</span>
          <input
            type="text"
            value={local.owner_name}
            onChange={(e) =>
              setLocal((s) => ({ ...s, owner_name: e.target.value }))
            }
            onBlur={() => commit({})}
            placeholder="例: 高橋"
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-[--c-accent]"
          />
        </label>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="t-label block mb-1">開始（週）</span>
            <input
              type="number"
              min={0}
              max={52}
              value={local.start_week}
              onChange={(e) =>
                commit({ start_week: parseInt(e.target.value || "0", 10) })
              }
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-[--c-accent] t-mono"
            />
          </label>
          <label className="block">
            <span className="t-label block mb-1">期間（週）</span>
            <input
              type="number"
              min={1}
              max={52}
              value={local.span_week}
              onChange={(e) =>
                commit({ span_week: parseInt(e.target.value || "1", 10) })
              }
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-[--c-accent] t-mono"
            />
          </label>
        </div>

        <label className="block mb-3">
          <span className="t-label block mb-1">進捗（%）</span>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={local.progress}
              onChange={(e) =>
                commit({ progress: parseInt(e.target.value, 10) })
              }
              className="flex-1"
            />
            <span className="t-mono text-[13px] w-12 text-right">
              {local.progress}%
            </span>
          </div>
        </label>

        <label className="block mb-3">
          <span className="t-label block mb-1">ステータス</span>
          <div className="grid grid-cols-4 gap-1.5">
            {(["todo", "doing", "review", "done"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => commit({ status: s })}
                className={
                  "rounded-md px-2 py-1.5 text-[11px] font-semibold transition " +
                  (local.status === s
                    ? "bg-ink text-white"
                    : "bg-white text-mute hover:bg-mute/5")
                }
              >
                {s === "todo"
                  ? "未着手"
                  : s === "doing"
                    ? "進行中"
                    : s === "review"
                      ? "レビュー"
                      : "完了"}
              </button>
            ))}
          </div>
        </label>

        <label className="block mb-3">
          <span className="t-label block mb-1">タグ</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => commit({ tag: "" })}
              className={
                "rounded-full px-3 py-1 text-[11px] font-semibold " +
                (local.tag === ""
                  ? "bg-ink text-white"
                  : "bg-white text-mute hover:bg-mute/5")
              }
            >
              なし
            </button>
            {TAGS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => commit({ tag: t })}
                className={
                  "rounded-full px-3 py-1 text-[11px] font-semibold " +
                  (local.tag === t
                    ? "bg-ink text-white"
                    : "bg-white text-mute hover:bg-mute/5")
                }
              >
                {t}
              </button>
            ))}
          </div>
        </label>

        <label className="flex items-center gap-2 mb-6">
          <input
            type="checkbox"
            checked={local.is_milestone}
            onChange={(e) => commit({ is_milestone: e.target.checked })}
          />
          <span className="text-[12.5px]">マイルストーンとして表示（菱形）</span>
        </label>

        <button
          type="button"
          onClick={() => {
            if (confirm("このタスクを削除しますか？")) onDelete();
          }}
          className="w-full rounded-lg bg-red-50 px-4 py-2.5 text-[12.5px] font-semibold text-error hover:bg-red-100"
        >
          🗑 タスクを削除
        </button>
      </aside>
    </>
  );
}
