"use client";

import { useMemo, useState } from "react";

import {
  addDays,
  daysBetween,
  monthsBetween,
  parseDate,
  toISODate,
  weeksBetween,
} from "@/lib/dates";
import type { Task } from "@/components/wbs/WbsBoard";
import type { Milestone } from "@/components/wbs/MilestoneEditor";

interface Props {
  tasks: Task[];
  milestones: Milestone[];
  /** プロジェクトの開始日（fallback で表示範囲を決める） */
  projectStart: Date | null;
  /** プロジェクトの完了予定（同上） */
  projectDue: Date | null;
  onSelect: (t: Task) => void;
}

const STATUS_BG: Record<string, string> = {
  todo: "rgba(150,170,200,.55)",
  doing: "var(--c-accent)",
  review: "var(--warn)",
  done: "var(--ok)",
};

const TREE_LABEL_W = 280;
const DAY_PX = 6; // 1日6px。1週=42px、4週=168px

/** タスクの開始/終了日を求める（start_date が無ければ start_week からの計算でフォールバック） */
function taskDates(t: Task, projectStart: Date | null): {
  start: Date | null;
  end: Date | null;
} {
  const start = parseDate(t.start_date);
  const end = parseDate(t.end_date);
  if (start && end) return { start, end };
  if (start && !end) return { start, end: addDays(start, 1) };
  // legacy fallback
  if (projectStart && t.start_week != null) {
    const s = addDays(projectStart, t.start_week * 7);
    const e = addDays(s, Math.max(1, t.span_week ?? 1) * 7 - 1);
    return { start: s, end: e };
  }
  return { start: null, end: null };
}

export function GanttView({
  tasks,
  milestones,
  projectStart,
  projectDue,
  onSelect,
}: Props) {
  // 表示する日付範囲を決定: タスクとマイルストーンの最小〜最大、プロジェクトの開始/完了を含めて余白
  const range = useMemo(() => {
    const dates: Date[] = [];
    if (projectStart) dates.push(projectStart);
    if (projectDue) dates.push(projectDue);
    for (const t of tasks) {
      const { start, end } = taskDates(t, projectStart);
      if (start) dates.push(start);
      if (end) dates.push(end);
    }
    for (const m of milestones) {
      const d = parseDate(m.date);
      if (d) dates.push(d);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dates.push(today);

    if (dates.length === 0) {
      const start = today;
      const end = addDays(start, 7 * 28);
      return { start, end };
    }
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    // 月の先頭にスナップ + 余白
    const start = new Date(min.getFullYear(), min.getMonth(), 1);
    const endMonth = new Date(max.getFullYear(), max.getMonth() + 1, 0);
    return { start, end: endMonth };
  }, [tasks, milestones, projectStart, projectDue]);

  const totalDays = Math.max(1, daysBetween(range.start, range.end) + 1);
  const totalWidth = totalDays * DAY_PX;

  const months = useMemo(
    () => monthsBetween(range.start, range.end),
    [range.start, range.end],
  );
  // weeksBetween は全プロジェクト通しの index を返す。
  // ここでは「その月の何週目か」(monthWeek: 1-5) を別途算出する。
  const weeks = useMemo(() => {
    const raw = weeksBetween(range.start, range.end);
    let prevMonth = -1;
    let counter = 0;
    return raw.map((w) => {
      const m = w.date.getMonth();
      if (m !== prevMonth) {
        counter = 1;
        prevMonth = m;
      } else {
        counter += 1;
      }
      return { ...w, monthWeek: counter };
    });
  }, [range.start, range.end]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayX =
    today >= range.start && today <= range.end
      ? daysBetween(range.start, today) * DAY_PX
      : null;

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

  const renderRows: { task: Task; depth: number }[] = [];
  for (const r of roots) {
    renderRows.push({ task: r, depth: 0 });
    if (expanded.has(r.id) && childrenByParent[r.id]) {
      for (const c of childrenByParent[r.id]) {
        renderRows.push({ task: c, depth: 1 });
      }
    }
  }

  const xOf = (d: Date) => daysBetween(range.start, d) * DAY_PX;

  return (
    <div className="overflow-x-auto">
      {/* ── ヘッダ: 月 / 週 ── */}
      <div
        className="border-b border-line-soft sticky top-0 bg-canvas z-10"
        style={{ minWidth: TREE_LABEL_W + totalWidth }}
      >
        <div className="flex">
          <div
            className="flex-shrink-0 border-r border-line-soft"
            style={{ width: TREE_LABEL_W }}
          />
          <div
            className="relative"
            style={{ width: totalWidth, height: 52 }}
          >
            {/* 月行 */}
            {months.map((m, i) => {
              const x = xOf(m.date);
              const nextX = months[i + 1]
                ? xOf(months[i + 1].date)
                : totalWidth;
              const w = Math.max(0, nextX - x);
              return (
                <div
                  key={i}
                  className="absolute top-0 h-[26px] border-l border-line-soft text-[11px] font-bold text-ink flex items-center"
                  style={{ left: x, width: w, paddingLeft: 6 }}
                >
                  {m.label}
                </div>
              );
            })}
            {/* 週行: 月内の W1〜W5 で表示 */}
            {weeks.map((w) => {
              const x = xOf(w.date);
              return (
                <div
                  key={w.index}
                  className="absolute top-[26px] h-[26px] border-l border-line-soft text-[9.5px] text-mute flex items-center"
                  style={{ left: x, width: 7 * DAY_PX, paddingLeft: 3 }}
                >
                  W{w.monthWeek}
                </div>
              );
            })}
            {/* Today */}
            {todayX !== null && (
              <div
                className="absolute top-0 bottom-0 z-10"
                style={{
                  left: todayX,
                  width: 2,
                  background: "var(--c-accent)",
                }}
              >
                <span className="absolute -top-1 left-1.5 inline-block rounded-full bg-[--c-accent] px-2 py-0.5 text-[9px] font-bold text-white whitespace-nowrap">
                  Today
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── マイルストーン行 ── */}
      {milestones.length > 0 && (
        <div
          className="flex items-center border-b border-line-soft bg-accent-soft/30"
          style={{ minWidth: TREE_LABEL_W + totalWidth, height: 32 }}
        >
          <div
            className="t-label px-3 flex-shrink-0 border-r border-line-soft"
            style={{ width: TREE_LABEL_W }}
          >
            📍 マイルストーン
          </div>
          <div
            className="relative"
            style={{ width: totalWidth, height: 32 }}
          >
            {milestones.map((m) => {
              const d = parseDate(m.date);
              if (!d || d < range.start || d > range.end) return null;
              const x = xOf(d);
              return (
                <div
                  key={m.id}
                  className="absolute group cursor-help"
                  style={{ left: x - 8, top: 8, width: 16, height: 16 }}
                  title={`${m.label} (${m.date ?? "—"})`}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      background: m.done
                        ? "var(--ink)"
                        : "var(--c-accent)",
                      border: "2px solid #fff",
                      transform: "rotate(45deg)",
                      boxShadow: "0 1px 4px rgba(40,80,180,.45)",
                    }}
                  />
                  <span className="absolute left-3 top-0 whitespace-nowrap text-[10px] font-semibold text-ink opacity-0 group-hover:opacity-100 transition pointer-events-none">
                    {m.label}
                  </span>
                </div>
              );
            })}
            {todayX !== null && (
              <div
                className="absolute top-0 bottom-0"
                style={{
                  left: todayX,
                  width: 2,
                  background: "var(--c-accent)",
                  opacity: 0.4,
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* ── 行 ── */}
      <div style={{ minWidth: TREE_LABEL_W + totalWidth }}>
        {renderRows.length === 0 ? (
          <div className="py-12 text-center t-cap">
            まだタスクがありません。「＋ 新しいタスク」から追加してください。
          </div>
        ) : (
          renderRows.map(({ task, depth }) => {
            const { start, end } = taskDates(task, projectStart);
            return (
              <Row
                key={task.id}
                task={task}
                depth={depth}
                hasChildren={Boolean(childrenByParent[task.id]?.length)}
                expanded={expanded.has(task.id)}
                onToggle={() => toggle(task.id)}
                onSelect={onSelect}
                rangeStart={range.start}
                totalWidth={totalWidth}
                start={start}
                end={end}
                todayX={todayX}
              />
            );
          })
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
  rangeStart: Date;
  totalWidth: number;
  start: Date | null;
  end: Date | null;
  todayX: number | null;
}

function fmtMD(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function Row({
  task,
  depth,
  hasChildren,
  expanded,
  onToggle,
  onSelect,
  rangeStart,
  totalWidth,
  start,
  end,
  todayX,
}: RowProps) {
  const isPhase = depth === 0;
  const bgColor = STATUS_BG[task.status] ?? STATUS_BG.todo;

  let left = 0;
  let width = 0;
  if (start && end) {
    left = Math.max(0, daysBetween(rangeStart, start) * DAY_PX);
    const days = Math.max(1, daysBetween(start, end) + 1);
    width = days * DAY_PX;
  }

  const dateRange =
    start && end ? `${fmtMD(start)} → ${fmtMD(end)}` : null;

  return (
    <div className="group flex items-center border-b border-line-soft min-h-[44px] hover:bg-accent-soft/30">
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
            {dateRange && <span className="t-mono">{dateRange}</span>}
            <span className="t-mono">{task.progress}%</span>
            {task.owner_name && <span>{task.owner_name}</span>}
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
        style={{ width: totalWidth, height: 44 }}
        onClick={() => onSelect(task)}
      >
        {/* today line */}
        {todayX !== null && (
          <div
            className="absolute top-0 bottom-0"
            style={{
              left: todayX,
              width: 2,
              background: "var(--c-accent)",
              opacity: 0.4,
            }}
          />
        )}
        {start && end ? (
          task.is_milestone ? (
            <>
              <div
                className="absolute"
                style={{ left: left + width / 2 - 7, top: 14 }}
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
              <div
                className="absolute t-mono text-[9.5px] text-mute whitespace-nowrap"
                style={{ left: left + width / 2 + 10, top: 14 }}
              >
                {fmtMD(start)}
              </div>
            </>
          ) : (
            <>
              <div
                className="absolute rounded-md overflow-hidden cursor-pointer transition-transform hover:scale-[1.01]"
                style={{
                  left,
                  width,
                  top: isPhase ? 10 : 14,
                  height: isPhase ? 24 : 16,
                  background: bgColor,
                  opacity: task.status === "todo" ? 0.6 : 1,
                }}
                title={`${fmtMD(start)} → ${fmtMD(end)}・${task.progress}%`}
              >
                {task.progress > 0 && task.status !== "done" && (
                  <div
                    className="absolute top-0 left-0 bottom-0"
                    style={{
                      width: `${task.progress}%`,
                      background: "rgba(0,0,0,.18)",
                    }}
                  />
                )}
                {width >= 80 && (
                  <div className="absolute inset-0 grid place-items-center text-[10px] font-bold text-white whitespace-nowrap px-1">
                    <span>
                      {fmtMD(start)}–{fmtMD(end)}
                      {isPhase ? ` · ${task.progress}%` : ""}
                    </span>
                  </div>
                )}
              </div>
              {/* バー幅が狭いときはバーの右側に日付ラベルをフロート */}
              {width < 80 && (
                <div
                  className="absolute t-mono text-[9.5px] text-mute whitespace-nowrap"
                  style={{
                    left: left + width + 4,
                    top: isPhase ? 14 : 17,
                  }}
                >
                  {fmtMD(start)}–{fmtMD(end)}
                </div>
              )}
            </>
          )
        ) : (
          <div className="absolute left-3 top-3 text-[10px] text-mute italic">
            （日付未設定）
          </div>
        )}
      </div>
    </div>
  );
}

export { toISODate };
