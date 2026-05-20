"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusDot } from "@/components/ui/StatusDot";
import type { Database } from "@/lib/types/database";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Meeting = Database["public"]["Tables"]["meetings"]["Row"];
type Recurrence =
  Database["public"]["Tables"]["meeting_recurrences"]["Row"];
type ProjectStub = {
  id: string;
  name: string;
  team_name: string | null;
  status: string;
};

interface ActionItemCount {
  meeting_id: string | null;
  status: string;
}

interface Props {
  orgSlug: string;
  projects: ProjectStub[];
  current: Project;
  initialMeetings: Meeting[];
  actionCounts: ActionItemCount[];
  initialRecurrences: Recurrence[];
}

const STATUS_META: Record<
  Meeting["status"],
  { label: string; bg: string; emo: string }
> = {
  scheduled: { label: "予定", bg: "var(--c-accent)", emo: "📅" },
  in_progress: { label: "進行中", bg: "var(--warn)", emo: "🟢" },
  finished: { label: "完了", bg: "var(--ok)", emo: "✓" },
  cancelled: { label: "中止", bg: "var(--mute)", emo: "✕" },
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "日時未定";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function MeetingsBoard({
  orgSlug,
  projects,
  current,
  initialMeetings,
  actionCounts,
  initialRecurrences,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [meetings, setMeetings] = useState<Meeting[]>(initialMeetings);
  const [recurrences, setRecurrences] = useState<Recurrence[]>(
    initialRecurrences,
  );
  const [filter, setFilter] = useState<"all" | Meeting["status"]>("all");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recurOpen, setRecurOpen] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: meetings.length,
      scheduled: 0,
      in_progress: 0,
      finished: 0,
      cancelled: 0,
    };
    for (const m of meetings) c[m.status] = (c[m.status] ?? 0) + 1;
    return c;
  }, [meetings]);

  const visible = useMemo(
    () =>
      filter === "all" ? meetings : meetings.filter((m) => m.status === filter),
    [meetings, filter],
  );

  // 会議ごとの action item 集計
  const actionsByMeeting = useMemo(() => {
    const map: Record<string, { open: number; done: number }> = {};
    for (const a of actionCounts) {
      if (!a.meeting_id) continue;
      if (!map[a.meeting_id]) map[a.meeting_id] = { open: 0, done: 0 };
      if (a.status === "done") map[a.meeting_id].done++;
      else map[a.meeting_id].open++;
    }
    return map;
  }, [actionCounts]);

  const createMeeting = async () => {
    setError(null);
    setCreating(true);
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    const { data, error: err } = await supabase
      .from("meetings")
      .insert({
        project_id: current.id,
        title: "新しい会議",
        scheduled_at: now.toISOString(),
        duration_min: 60,
        status: "scheduled",
      })
      .select()
      .single();
    setCreating(false);
    if (err || !data) {
      setError(err?.message ?? "会議の作成に失敗しました");
      return;
    }
    router.push(`/${orgSlug}/projects/${current.id}/meetings/${data.id}`);
  };

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
            📅
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-[18px] font-extrabold tracking-tight truncate">
                {current.name} の会議
              </h1>
              <StatusDot status={current.status} />
            </div>
            <div className="t-cap truncate">
              {meetings.length} 件の会議・議事録 + Action Items
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setRecurOpen(true)}
            className="rounded-full bg-white border border-line px-4 py-2 text-[12px] font-semibold text-ink hover:bg-mute/5"
          >
            📅 定例を設定
          </button>
          <button
            type="button"
            onClick={createMeeting}
            disabled={creating}
            className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {creating ? "..." : "＋ 新しい会議"}
          </button>
        </div>
      </GlassCard>

      {/* 定例ルールのリスト */}
      {recurrences.length > 0 && (
        <GlassCard className="p-4">
          <div className="t-label mb-2">🔁 定例会議ルール</div>
          <ul className="flex flex-col gap-1.5">
            {recurrences.map((r) => (
              <RecurrenceRow
                key={r.id}
                rec={r}
                onDelete={async () => {
                  if (!confirm("この定例ルールを削除しますか？")) return;
                  setRecurrences((prev) => prev.filter((x) => x.id !== r.id));
                  const { error: err } = await supabase
                    .from("meeting_recurrences")
                    .delete()
                    .eq("id", r.id);
                  if (err) setError(err.message);
                }}
              />
            ))}
          </ul>
        </GlassCard>
      )}

      {recurOpen && (
        <RecurrenceFormModal
          projectId={current.id}
          onClose={() => setRecurOpen(false)}
          onCreated={(rec) => {
            setRecurrences((prev) => [...prev, rec]);
            setRecurOpen(false);
            router.refresh();
          }}
        />
      )}

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <FilterChip
          label="すべて"
          count={counts.all}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        {(["scheduled", "in_progress", "finished", "cancelled"] as const).map(
          (s) => (
            <FilterChip
              key={s}
              label={STATUS_META[s].label}
              emo={STATUS_META[s].emo}
              count={counts[s] ?? 0}
              active={filter === s}
              onClick={() => setFilter(s)}
            />
          ),
        )}
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <div className="text-4xl mb-3">📭</div>
          <h3 className="t-h3 mb-1">
            {filter === "all"
              ? "まだ会議がありません"
              : "該当する会議がありません"}
          </h3>
          <p className="t-cap mb-5">
            「＋ 新しい会議」から作成してください。
          </p>
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((m) => {
            const meta = STATUS_META[m.status];
            const actions = actionsByMeeting[m.id] ?? { open: 0, done: 0 };
            return (
              <Link
                key={m.id}
                href={`/${orgSlug}/projects/${current.id}/meetings/${m.id}`}
                className="block"
              >
                <GlassCard className="p-4 lift cursor-pointer">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-10 w-10 place-items-center rounded-xl text-white text-[13px] font-bold"
                      style={{ background: meta.bg }}
                    >
                      {meta.emo}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <h3 className="text-[13.5px] font-bold truncate">
                          {m.title}
                        </h3>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                          style={{ background: meta.bg }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div className="t-cap flex items-center gap-3 flex-wrap">
                        <span>📅 {formatDateTime(m.scheduled_at)}</span>
                        <span>⏱ {m.duration_min}分</span>
                        {m.location && <span>📍 {m.location}</span>}
                        {(actions.open + actions.done) > 0 && (
                          <span>
                            ✅ Action {actions.done}/{actions.open + actions.done}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="t-cap opacity-50">›</span>
                  </div>
                </GlassCard>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
  emo,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  emo?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition " +
        (active
          ? "bg-ink text-white"
          : "bg-white text-mute hover:bg-mute/5")
      }
    >
      {emo && <span aria-hidden>{emo}</span>}
      <span>{label}</span>
      <span
        className={
          "rounded-full px-1.5 text-[10px] " +
          (active ? "bg-white/20" : "bg-mute/10 text-mute")
        }
      >
        {count}
      </span>
    </button>
  );
}

const DOW_LABEL = ["日", "月", "火", "水", "木", "金", "土"];
const INTERVAL_LABEL: Record<Recurrence["interval"], string> = {
  weekly: "毎週",
  biweekly: "隔週",
  monthly: "毎月",
};

function describeRecurrence(r: Recurrence): string {
  const time = r.start_time.slice(0, 5);
  if (r.interval === "monthly") {
    return `${INTERVAL_LABEL[r.interval]} ${r.day_of_month ?? "?"} 日 ${time}〜 (${r.duration_min}分)`;
  }
  return `${INTERVAL_LABEL[r.interval]}${
    r.day_of_week !== null ? DOW_LABEL[r.day_of_week] : "?"
  }曜 ${time}〜 (${r.duration_min}分)`;
}

function RecurrenceRow({
  rec,
  onDelete,
}: {
  rec: Recurrence;
  onDelete: () => Promise<void>;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-line-soft bg-white px-3 py-2">
      <span
        className="grid h-9 w-9 place-items-center rounded-xl text-white text-[14px]"
        style={{ background: "var(--c-accent)" }}
        aria-hidden
      >
        🔁
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-bold truncate">{rec.title}</div>
        <div className="t-cap truncate">
          {describeRecurrence(rec)}
          {rec.location ? ` ・ 📍 ${rec.location}` : ""}
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-md px-2 py-1 text-[11px] text-mute hover:text-error hover:bg-red-50"
        aria-label="ルールを削除"
      >
        ✕
      </button>
    </li>
  );
}

function RecurrenceFormModal({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: string;
  onClose: () => void;
  onCreated: (rec: Recurrence) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [title, setTitle] = useState("週次 定例 MTG");
  const [interval, setInterval] = useState<"weekly" | "biweekly" | "monthly">(
    "weekly",
  );
  const [dayOfWeek, setDayOfWeek] = useState(3); // 水曜
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [startTime, setStartTime] = useState("10:00");
  const [durationMin, setDurationMin] = useState(60);
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const submit = async () => {
    if (!title.trim()) {
      setError("タイトルを入力してください");
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      project_id: projectId,
      title: title.trim(),
      interval,
      day_of_week: interval === "monthly" ? null : dayOfWeek,
      day_of_month: interval === "monthly" ? dayOfMonth : null,
      start_time: startTime + ":00",
      duration_min: durationMin,
      location: location.trim() || null,
    };
    const { data, error: err } = await supabase
      .from("meeting_recurrences")
      .insert(payload)
      .select()
      .single();
    setBusy(false);
    if (err || !data) {
      setError(err?.message ?? "作成に失敗しました");
      return;
    }
    onCreated(data);
  };

  if (!mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center px-4 py-6 overflow-y-auto"
      onClick={onClose}
      style={{ background: "rgba(15,23,42,0.55)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white border border-line-soft shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft">
          <h3 className="t-h3">📅 定例会議を設定</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="rounded-md px-2 py-1 text-mute hover:bg-mute/10 text-[13px]"
          >
            ✕
          </button>
        </div>
        <div className="p-5 grid grid-cols-1 gap-3">
          <label className="block">
            <span className="t-label block mb-1">タイトル</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[--c-accent]"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="t-label block mb-1">繰り返し</span>
              <select
                value={interval}
                onChange={(e) =>
                  setInterval(
                    e.target.value as "weekly" | "biweekly" | "monthly",
                  )
                }
                className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12.5px]"
              >
                <option value="weekly">毎週</option>
                <option value="biweekly">隔週</option>
                <option value="monthly">毎月</option>
              </select>
            </label>
            {interval === "monthly" ? (
              <label className="block">
                <span className="t-label block mb-1">日にち</span>
                <select
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Number(e.target.value))}
                  className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12.5px]"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d} 日
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="block">
                <span className="t-label block mb-1">曜日</span>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                  className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12.5px]"
                >
                  {DOW_LABEL.map((d, i) => (
                    <option key={i} value={i}>
                      {d}曜
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="t-label block mb-1">開始時刻</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12.5px]"
              />
            </label>
            <label className="block">
              <span className="t-label block mb-1">所要 (分)</span>
              <input
                type="number"
                min={15}
                max={300}
                step={15}
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12.5px]"
              />
            </label>
          </div>
          <label className="block">
            <span className="t-label block mb-1">場所 (任意)</span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="例: Zoom / オフィス 会議室 A"
              className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12.5px]"
            />
          </label>
          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-700">
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-line-soft">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white border border-line px-4 py-2 text-[12.5px] font-medium text-mute"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-ink px-5 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "保存中…" : "✦ 設定する"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
