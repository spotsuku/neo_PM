"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusDot } from "@/components/ui/StatusDot";
import { ProjectPicker } from "@/components/projects/ProjectPicker";
import type { Database } from "@/lib/types/database";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Meeting = Database["public"]["Tables"]["meetings"]["Row"];
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
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [meetings, setMeetings] = useState<Meeting[]>(initialMeetings);
  const [filter, setFilter] = useState<"all" | Meeting["status"]>("all");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    router.push(`/${orgSlug}/meetings/${data.id}`);
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
            onClick={createMeeting}
            disabled={creating}
            className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {creating ? "..." : "＋ 新しい会議"}
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
                href={`/${orgSlug}/meetings/${m.id}`}
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
