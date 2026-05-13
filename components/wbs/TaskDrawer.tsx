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
    start_date: task.start_date ?? "",
    end_date: task.end_date ?? "",
    progress: task.progress,
    status: task.status,
    tag: task.tag ?? "",
    is_milestone: task.is_milestone,
  });

  useEffect(() => {
    setLocal({
      title: task.title,
      owner_name: task.owner_name ?? "",
      start_date: task.start_date ?? "",
      end_date: task.end_date ?? "",
      progress: task.progress,
      status: task.status,
      tag: task.tag ?? "",
      is_milestone: task.is_milestone,
    });
  }, [task]);

  const commit = (patch: Partial<typeof local>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    // end_date が start_date より前なら自動補正
    let normalizedEnd = next.end_date;
    if (
      next.start_date &&
      next.end_date &&
      next.end_date < next.start_date
    ) {
      normalizedEnd = next.start_date;
      setLocal((s) => ({ ...s, end_date: next.start_date }));
    }
    onSave({
      title: next.title,
      owner_name: next.owner_name || null,
      start_date: next.start_date || null,
      end_date: normalizedEnd || null,
      progress: Math.max(0, Math.min(100, next.progress)),
      status: next.status,
      tag: next.tag || null,
      is_milestone: next.is_milestone,
    });
  };

  // 期間（日数）を計算
  const days =
    local.start_date && local.end_date
      ? Math.max(
          1,
          Math.round(
            (new Date(local.end_date).getTime() -
              new Date(local.start_date).getTime()) /
              86400000,
          ) + 1,
        )
      : null;

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

        <div className="grid grid-cols-2 gap-3 mb-1">
          <label className="block">
            <span className="t-label block mb-1">開始日</span>
            <input
              type="date"
              value={local.start_date}
              onChange={(e) => commit({ start_date: e.target.value })}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-[--c-accent] t-mono"
            />
          </label>
          <label className="block">
            <span className="t-label block mb-1">終了日</span>
            <input
              type="date"
              value={local.end_date}
              onChange={(e) => commit({ end_date: e.target.value })}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-[--c-accent] t-mono"
            />
          </label>
        </div>
        <div className="t-cap mb-3 text-right">
          {days !== null ? `期間: ${days}日` : "日付を設定してください"}
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

        <label className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            checked={local.is_milestone}
            onChange={(e) => commit({ is_milestone: e.target.checked })}
          />
          <span className="text-[12.5px]">マイルストーンとして表示（菱形）</span>
        </label>
        <p className="t-cap mb-6 leading-relaxed">
          通常のプロジェクトの節目は <strong>📍 マイルストーン</strong> 欄で管理を推奨。
          ここはタスク自身を菱形マークで強調したい場合のみ。
        </p>

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
