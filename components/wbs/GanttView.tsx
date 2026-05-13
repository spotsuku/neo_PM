"use client";

import { useMemo, useState } from "react";

import type { Task } from "@/components/wbs/WbsBoard";

interface Props {
  tasks: Task[];
  totalWeeks: number;
  weekPx: number;
  todayWeek: number | null;
  onSelect: (t: Task) => void;
}

const STATUS_BG: Record<string, string> = {
  todo: "rgba(150,170,200,.55)",
  doing: "var(--c-accent)",
  review: "var(--warn)",
  done: "var(--ok)",
};

const TREE_LABEL_W = 320;

export function GanttView({
  tasks,
  totalWeeks,
  weekPx,
  todayWeek,
  onSelect,
}: Props) {
  const totalWidth = totalWeeks * weekPx;
  const { roots, childrenByParent } = useMemo(() => {
    const r: Task[] = [];
    const map: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (t.parent_id) {
        if (!map[t.parent_id]) map[t.parent_id] = [];
        map[t.parent_id].push(t);
      } else {
        r.push(t);
      }
    }
    return { roots: r, childrenByParent: map };
  }, [tasks]);

  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(roots.map((r) => r.id)),
  );
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // 描画する行（折りたたみを考慮）
  const renderRows: { task: Task; depth: number }[] = [];
  for (const r of roots) {
    renderRows.push({ task: r, depth: 0 });
    if (expanded.has(r.id) && childrenByParent[r.id]) {
      for (const c of childrenByParent[r.id]) {
        renderRows.push({ task: c, depth: 1 });
      }
    }
  }

  return (
    <div className="overflow-x-auto">
      {/* 週軸ヘッダー */}
      <div
        className="flex items-end border-b border-line-soft sticky top-0 bg-canvas z-10"
        style={{ minWidth: TREE_LABEL_W + totalWidth }}
      >
        <div
          className="t-label px-3 py-2 flex-shrink-0"
          style={{ width: TREE_LABEL_W }}
        >
          タスク
        </div>
        <div
          className="relative flex"
          style={{ width: totalWidth, height: 32 }}
        >
          {Array.from({ length: totalWeeks }).map((_, w) => (
            <div
              key={w}
              className="border-l border-line-soft text-[10px] text-mute"
              style={{ width: weekPx }}
            >
              {w % 4 === 0 ? (
                <span className="px-1">W{w + 1}</span>
              ) : null}
            </div>
          ))}
          {todayWeek !== null && (
            <div
              className="absolute top-0 bottom-0 z-10"
              style={{
                left: todayWeek * weekPx,
                width: 2,
                background: "var(--c-accent)",
              }}
            >
              <span className="absolute -top-1 left-1.5 inline-block rounded-full bg-[--c-accent] px-2 py-0.5 text-[9px] font-bold text-white">
                Today
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 行 */}
      <div style={{ minWidth: TREE_LABEL_W + totalWidth }}>
        {renderRows.length === 0 ? (
          <div className="py-12 text-center t-cap">
            まだタスクがありません。「＋ 新しいタスク」から追加してください。
          </div>
        ) : (
          renderRows.map(({ task, depth }) => (
            <Row
              key={task.id}
              task={task}
              depth={depth}
              hasChildren={Boolean(childrenByParent[task.id]?.length)}
              expanded={expanded.has(task.id)}
              onToggle={() => toggle(task.id)}
              onSelect={onSelect}
              totalWeeks={totalWeeks}
              weekPx={weekPx}
              todayWeek={todayWeek}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface RowProps {
  task: Task;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSelect: (t: Task) => void;
  totalWeeks: number;
  weekPx: number;
  todayWeek: number | null;
}

function Row({
  task,
  depth,
  hasChildren,
  expanded,
  onToggle,
  onSelect,
  totalWeeks,
  weekPx,
  todayWeek,
}: RowProps) {
  const totalWidth = totalWeeks * weekPx;
  const start = Math.max(0, task.start_week ?? 0);
  const span = Math.max(1, task.span_week ?? 1);
  const left = start * weekPx;
  const width = Math.min(totalWidth - left, span * weekPx);

  const bgColor = STATUS_BG[task.status] ?? STATUS_BG.todo;
  const isPhase = depth === 0;

  return (
    <div className="group flex items-center border-b border-line-soft min-h-[40px] hover:bg-accent-soft/30">
      {/* ラベル列 */}
      <div
        className="flex items-center gap-1.5 px-3 py-2 flex-shrink-0"
        style={{ width: TREE_LABEL_W, paddingLeft: 12 + depth * 16 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={onToggle}
            className="grid h-5 w-5 place-items-center rounded text-mute hover:bg-mute/10"
            aria-label={expanded ? "折りたたむ" : "展開"}
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="inline-block w-5" />
        )}
        <button
          type="button"
          onClick={() => onSelect(task)}
          className="flex-1 min-w-0 text-left"
        >
          <div
            className={
              "text-[12.5px] truncate " +
              (isPhase ? "font-bold" : "font-medium")
            }
          >
            {task.title}
          </div>
          <div className="t-cap truncate flex items-center gap-2">
            {task.owner_name && <span>{task.owner_name}</span>}
            <span className="t-mono">{task.progress}%</span>
            {task.tag && (
              <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[9px] font-semibold text-[--c-accent-deep]">
                {task.tag}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* バー領域 */}
      <div
        className="relative"
        style={{ width: totalWidth, height: 40 }}
        onClick={() => onSelect(task)}
      >
        {/* week grid */}
        {Array.from({ length: totalWeeks }).map((_, w) => (
          <div
            key={w}
            className="absolute top-0 bottom-0 border-l border-line-soft/40"
            style={{ left: w * weekPx, width: 1 }}
          />
        ))}
        {/* today line */}
        {todayWeek !== null && (
          <div
            className="absolute top-0 bottom-0"
            style={{
              left: todayWeek * weekPx,
              width: 2,
              background: "var(--c-accent)",
              opacity: 0.4,
            }}
          />
        )}
        {/* マイルストーン菱形 */}
        {task.is_milestone ? (
          <div
            className="absolute"
            style={{
              left: left + weekPx / 2 - 7,
              top: 12,
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                background: "var(--c-accent)",
                border: "2px solid #fff",
                transform: "rotate(45deg)",
                boxShadow: "0 1px 4px rgba(40,80,180,.45)",
              }}
            />
          </div>
        ) : (
          /* タスクバー */
          <div
            className="absolute rounded-md overflow-hidden cursor-pointer transition-transform hover:scale-[1.01]"
            style={{
              left,
              width,
              top: isPhase ? 8 : 12,
              height: isPhase ? 24 : 16,
              background: bgColor,
              opacity: task.status === "todo" ? 0.6 : 1,
            }}
          >
            {/* 進捗内 fill */}
            {task.progress > 0 && task.status !== "done" && (
              <div
                className="absolute top-0 left-0 bottom-0"
                style={{
                  width: `${task.progress}%`,
                  background: "rgba(0,0,0,.18)",
                }}
              />
            )}
            {isPhase && (
              <div className="absolute inset-0 grid place-items-center text-[10px] font-bold text-white">
                {task.progress}%
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
