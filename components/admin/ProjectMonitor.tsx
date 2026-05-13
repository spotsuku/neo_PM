"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { GlassCard } from "@/components/ui/GlassCard";
import type { ProjectStats } from "@/lib/admin";

interface Props {
  orgSlug: string;
  projects: ProjectStats[];
  hasAnthropic: boolean;
}

const HEALTH_META: Record<
  ProjectStats["health"],
  { emo: string; label: string; bg: string }
> = {
  good: { emo: "🟢", label: "順調", bg: "var(--ok)" },
  watch: { emo: "🟡", label: "注意", bg: "var(--warn)" },
  stalled: { emo: "🔴", label: "停滞", bg: "var(--error)" },
};

type Filter = "all" | "alert" | "stalled" | "watch" | "good";

interface AISuggestion {
  title: string;
  detail: string;
  kind: "quest" | "meeting" | "task";
}

export function ProjectMonitor({
  orgSlug,
  projects,
  hasAnthropic,
}: Props) {
  const [filter, setFilter] = useState<Filter>("alert");
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<
    Record<string, AISuggestion[]>
  >({});
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return projects;
    if (filter === "alert")
      return projects.filter((p) => p.health !== "good");
    return projects.filter((p) => p.health === filter);
  }, [projects, filter]);

  const counts = useMemo(
    () => ({
      all: projects.length,
      alert: projects.filter((p) => p.health !== "good").length,
      stalled: projects.filter((p) => p.health === "stalled").length,
      watch: projects.filter((p) => p.health === "watch").length,
      good: projects.filter((p) => p.health === "good").length,
    }),
    [projects],
  );

  const runActivate = async (projectId: string) => {
    setActivatingId(projectId);
    setError(null);
    try {
      const res = await fetch("/api/ai/activate-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `エラー (${res.status})`);
      }
      const data = (await res.json()) as { suggestions: AISuggestion[] };
      setSuggestions((prev) => ({
        ...prev,
        [projectId]: data.suggestions ?? [],
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "失敗しました");
    } finally {
      setActivatingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        <FilterPill
          label="⚠ 要注意"
          count={counts.alert}
          active={filter === "alert"}
          onClick={() => setFilter("alert")}
          tone="warn"
        />
        <FilterPill
          label="🔴 停滞"
          count={counts.stalled}
          active={filter === "stalled"}
          onClick={() => setFilter("stalled")}
          tone="error"
        />
        <FilterPill
          label="🟡 注意"
          count={counts.watch}
          active={filter === "watch"}
          onClick={() => setFilter("watch")}
        />
        <FilterPill
          label="🟢 順調"
          count={counts.good}
          active={filter === "good"}
          onClick={() => setFilter("good")}
        />
        <FilterPill
          label="すべて"
          count={counts.all}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
      </div>

      {filtered.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <div className="text-3xl mb-2">🎉</div>
          <p className="t-cap">該当するプロジェクトはありません</p>
        </GlassCard>
      ) : (
        filtered.map((p) => {
          const meta = HEALTH_META[p.health];
          const suggestionsForP = suggestions[p.id];
          const totalAi = p.aiMessages30d;
          return (
            <GlassCard
              key={p.id}
              className="p-4"
              style={{ borderLeft: `4px solid ${meta.bg}` }}
            >
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-start">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                      style={{ background: meta.bg }}
                    >
                      {meta.emo} {meta.label}
                    </span>
                    <h3 className="text-[14px] font-bold">{p.name}</h3>
                    {p.team_name && (
                      <span className="t-cap">/ {p.team_name}</span>
                    )}
                    <span className="t-cap">
                      status: <span className="font-bold">{p.status}</span>
                    </span>
                  </div>
                  <div className="t-cap grid grid-cols-2 md:grid-cols-5 gap-x-3 gap-y-0.5 mb-2">
                    <span>📅 {p.daysSinceUpdate}日前 更新</span>
                    <span>🔥 連続 {p.streak_days}日</span>
                    <span>
                      ✅ {p.taskCounts.done}/{p.taskCounts.total} タスク完了
                    </span>
                    <span>📍 期限超過 {p.overdueMilestones}</span>
                    <span>✦ AI {totalAi}回 (30d)</span>
                  </div>
                  {p.alerts.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {p.alerts.map((a) => (
                        <span
                          key={a}
                          className="rounded-full bg-warn/15 px-2 py-0.5 text-[10.5px] font-semibold text-warn"
                        >
                          ⚠ {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <Link
                    href={`/${orgSlug}/dashboard?p=${p.id}`}
                    className="rounded-md bg-white border border-line px-2.5 py-1 text-[11px] font-semibold text-mute hover:text-ink"
                  >
                    → 開く
                  </Link>
                  {p.health !== "good" && (
                    <button
                      type="button"
                      onClick={() => runActivate(p.id)}
                      disabled={activatingId === p.id || !hasAnthropic}
                      className="rounded-md bg-ink px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      title={
                        !hasAnthropic
                          ? "ANTHROPIC_API_KEY 未設定"
                          : "AI で活性化案を生成"
                      }
                    >
                      {activatingId === p.id
                        ? "✦ 生成中…"
                        : "✦ AI で活性化案"}
                    </button>
                  )}
                </div>
              </div>

              {/* AI 提案 */}
              {suggestionsForP && suggestionsForP.length > 0 && (
                <div className="mt-3 rounded-lg bg-accent-soft p-3">
                  <div className="t-label mb-2 text-[--c-accent-deep]">
                    💡 NEO.ai の提案
                  </div>
                  <ul className="flex flex-col gap-2">
                    {suggestionsForP.map((s, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-[12px]"
                      >
                        <span
                          className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white flex-shrink-0"
                          style={{
                            background:
                              s.kind === "quest"
                                ? "var(--c-accent)"
                                : s.kind === "meeting"
                                  ? "var(--warn)"
                                  : "var(--ok)",
                          }}
                        >
                          {i + 1}
                        </span>
                        <div className="flex-1">
                          <div className="font-semibold">{s.title}</div>
                          <div className="t-cap leading-relaxed">
                            {s.detail}
                          </div>
                        </div>
                        <span
                          className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold"
                          style={{ color: "var(--ink)" }}
                        >
                          {s.kind === "quest"
                            ? "🎯 クエスト"
                            : s.kind === "meeting"
                              ? "📅 会議"
                              : "📋 タスク"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </GlassCard>
          );
        })
      )}
    </div>
  );
}

function FilterPill({
  label,
  count,
  active,
  onClick,
  tone,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone?: "warn" | "error";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition " +
        (active
          ? tone === "error"
            ? "bg-error text-white"
            : tone === "warn"
              ? "bg-warn text-white"
              : "bg-ink text-white"
          : "bg-white text-mute hover:bg-mute/5")
      }
    >
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
