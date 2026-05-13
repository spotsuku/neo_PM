"use client";

import { useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusDot } from "@/components/ui/StatusDot";
import { ProjectPicker } from "@/components/projects/ProjectPicker";
import { GanttView } from "@/components/wbs/GanttView";
import { TreeView } from "@/components/wbs/TreeView";
import { KanbanView } from "@/components/wbs/KanbanView";
import { TaskDrawer } from "@/components/wbs/TaskDrawer";
import type { Database } from "@/lib/types/database";

type Project = Database["public"]["Tables"]["projects"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
type ProjectStub = {
  id: string;
  name: string;
  team_name: string | null;
  status: string;
};

interface Props {
  orgSlug: string;
  projects: ProjectStub[];
  current: Project;
  initialTasks: Task[];
  initialView: "gantt" | "tree" | "kanban";
}

const TOTAL_WEEKS = 28;
const WEEK_PX = 24;

export function WbsBoard({
  orgSlug,
  projects,
  current,
  initialTasks,
  initialView,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [view, setView] = useState<"gantt" | "tree" | "kanban">(initialView);
  const [drawerTask, setDrawerTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 集計
  const stats = useMemo(() => {
    const done = tasks.filter((t) => t.status === "done").length;
    const doing = tasks.filter(
      (t) => t.status === "doing" || t.status === "review",
    ).length;
    const overdue = tasks.filter((t) => {
      if (t.status === "done" || t.start_week == null || t.span_week == null)
        return false;
      // "今週" を未指定（プロジェクト開始日から週で換算）
      const startedAt = current.started_at
        ? new Date(current.started_at).getTime()
        : Date.now();
      const nowWeek = Math.floor((Date.now() - startedAt) / (7 * 86400000));
      return t.start_week + t.span_week < nowWeek && t.progress < 100;
    }).length;
    return { done, doing, overdue, total: tasks.length };
  }, [tasks, current.started_at]);

  // Today カラム位置
  const todayWeek = useMemo(() => {
    if (!current.started_at) return null;
    const w = Math.floor(
      (Date.now() - new Date(current.started_at).getTime()) /
        (7 * 86400000),
    );
    if (w < 0 || w > TOTAL_WEEKS) return null;
    return w;
  }, [current.started_at]);

  const createTask = async (partial?: Partial<Task>) => {
    const insert = {
      project_id: current.id,
      title: partial?.title ?? "新しいタスク",
      owner_name: partial?.owner_name ?? null,
      start_week: partial?.start_week ?? 0,
      span_week: partial?.span_week ?? 2,
      progress: 0,
      status: partial?.status ?? "todo",
      parent_id: partial?.parent_id ?? null,
      tag: partial?.tag ?? null,
      is_milestone: partial?.is_milestone ?? false,
    } as const;
    const { data, error: err } = await supabase
      .from("tasks")
      .insert(insert)
      .select()
      .single();
    if (err || !data) {
      setError(err?.message ?? "タスク追加に失敗しました");
      return;
    }
    setTasks((prev) => [...prev, data]);
    setDrawerTask(data);
  };

  const updateTask = async (id: string, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const { error: err } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", id);
    if (err) setError(err.message);
    // ローカルでドロワーを更新
    setDrawerTask((cur) => (cur && cur.id === id ? { ...cur, ...patch } : cur));
  };

  const deleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setDrawerTask(null);
    const { error: err } = await supabase.from("tasks").delete().eq("id", id);
    if (err) setError(err.message);
  };

  const switchView = (v: "gantt" | "tree" | "kanban") => setView(v);

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {/* Header */}
      <GlassCard className="p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="grid h-12 w-12 place-items-center rounded-2xl text-white text-xl"
            style={{
              background:
                "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
            }}
          >
            📋
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-[18px] font-extrabold tracking-tight truncate">
                {current.name} の WBS
              </h1>
              <StatusDot status={current.status} />
            </div>
            <div className="t-cap truncate">
              {current.team_name ?? ""}{" "}
              {current.idea_title ? `・ ${current.idea_title}` : ""}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View 切替 */}
          <div className="inline-flex rounded-full bg-white p-1 shadow-[0_1px_0_var(--line-soft)] text-[11px] font-semibold">
            {([
              ["gantt", "🗓 ガント"],
              ["tree", "🌲 ツリー"],
              ["kanban", "📊 カンバン"],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => switchView(k)}
                className={
                  "px-3 py-1.5 rounded-full transition " +
                  (view === k
                    ? "bg-ink text-white"
                    : "text-mute hover:text-ink")
                }
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => createTask()}
            className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white hover:opacity-90"
          >
            ＋ 新しいタスク
          </button>
          <ProjectPicker
            orgSlug={orgSlug}
            projects={projects}
            currentId={current.id}
          />
        </div>
      </GlassCard>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 統計 3 枚 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="完了" value={stats.done} total={stats.total} color="var(--ok)" />
        <StatCard label="進行中" value={stats.doing} total={stats.total} color="var(--c-accent)" />
        <StatCard label="期限超過" value={stats.overdue} total={stats.total} color="var(--error)" />
      </div>

      {/* メイン */}
      <GlassCard className="p-0 overflow-hidden">
        {view === "gantt" && (
          <GanttView
            tasks={tasks}
            totalWeeks={TOTAL_WEEKS}
            weekPx={WEEK_PX}
            todayWeek={todayWeek}
            onSelect={(t) => setDrawerTask(t)}
          />
        )}
        {view === "tree" && (
          <TreeView
            tasks={tasks}
            onSelect={(t) => setDrawerTask(t)}
            onAddChild={(parentId) => createTask({ parent_id: parentId })}
          />
        )}
        {view === "kanban" && (
          <KanbanView
            tasks={tasks}
            onSelect={(t) => setDrawerTask(t)}
            onMove={(id, status) => updateTask(id, { status })}
          />
        )}
      </GlassCard>

      {drawerTask && (
        <TaskDrawer
          task={drawerTask}
          onClose={() => setDrawerTask(null)}
          onSave={(patch) => updateTask(drawerTask.id, patch)}
          onDelete={() => deleteTask(drawerTask.id)}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <GlassCard className="p-4">
      <div className="t-label mb-1">{label}</div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="t-big" style={{ fontSize: 26 }}>
          {value}
        </span>
        <span className="t-cap">/ {total}</span>
      </div>
      <div className="h-1.5 rounded-full bg-line-soft overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </GlassCard>
  );
}
