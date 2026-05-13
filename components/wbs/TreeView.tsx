"use client";

import { useMemo, useState } from "react";

import type { Task } from "@/components/wbs/WbsBoard";

interface Props {
  tasks: Task[];
  onSelect: (t: Task) => void;
  onAddChild: (parentId: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  todo: "未着手",
  doing: "進行中",
  review: "レビュー",
  done: "完了",
};

const STATUS_COLOR: Record<string, string> = {
  todo: "var(--mute)",
  doing: "var(--c-accent)",
  review: "var(--warn)",
  done: "var(--ok)",
};

export function TreeView({ tasks, onSelect, onAddChild }: Props) {
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

  if (roots.length === 0) {
    return (
      <div className="py-12 text-center t-cap">
        タスクがありません。「＋ 新しいタスク」から追加してください。
      </div>
    );
  }

  return (
    <div className="p-4">
      <ul className="flex flex-col">
        {roots.map((r) => (
          <Node
            key={r.id}
            task={r}
            children={childrenByParent[r.id] ?? []}
            expanded={expanded.has(r.id)}
            onToggle={() => toggle(r.id)}
            onSelect={onSelect}
            onAddChild={onAddChild}
            depth={0}
          />
        ))}
      </ul>
    </div>
  );
}

interface NodeProps {
  task: Task;
  children: Task[];
  expanded: boolean;
  onToggle: () => void;
  onSelect: (t: Task) => void;
  onAddChild: (parentId: string) => void;
  depth: number;
}

function Node({
  task,
  children,
  expanded,
  onToggle,
  onSelect,
  onAddChild,
  depth,
}: NodeProps) {
  return (
    <li>
      <div
        className="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-accent-soft/40"
        style={{ paddingLeft: 8 + depth * 24 }}
      >
        {children.length > 0 ? (
          <button
            type="button"
            onClick={onToggle}
            className="grid h-6 w-6 place-items-center rounded text-mute hover:bg-mute/10"
            aria-label={expanded ? "折りたたむ" : "展開"}
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="inline-block w-6" />
        )}
        <button
          type="button"
          onClick={() => onSelect(task)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: STATUS_COLOR[task.status] }}
            />
            <div
              className={
                "text-[13px] truncate " +
                (depth === 0 ? "font-bold" : "font-medium")
              }
            >
              {task.title}
            </div>
            <span className="t-cap whitespace-nowrap">
              {STATUS_LABEL[task.status]}
            </span>
            <span className="t-mono">{task.progress}%</span>
          </div>
          {(task.owner_name || task.tag) && (
            <div className="t-cap mt-0.5 flex items-center gap-2">
              {task.owner_name && <span>{task.owner_name}</span>}
              {task.tag && (
                <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[9px] font-semibold text-[--c-accent-deep]">
                  {task.tag}
                </span>
              )}
            </div>
          )}
        </button>
        {depth === 0 && (
          <button
            type="button"
            onClick={() => onAddChild(task.id)}
            className="opacity-0 group-hover:opacity-100 rounded-md px-2 py-1 text-[11px] font-semibold text-mute hover:bg-white hover:text-ink transition"
          >
            ＋ サブ
          </button>
        )}
      </div>
      {children.length > 0 && expanded && (
        <ul>
          {children.map((c) => (
            <Node
              key={c.id}
              task={c}
              children={[]}
              expanded={false}
              onToggle={() => {}}
              onSelect={onSelect}
              onAddChild={onAddChild}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
