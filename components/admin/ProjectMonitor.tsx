"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import type { ProjectStats } from "@/lib/admin";

interface Props {
  orgSlug: string;
  projects: ProjectStats[];
  hasAnthropic: boolean;
  canDelete?: boolean;
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
  canDelete = false,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [filter, setFilter] = useState<Filter>("alert");
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<
    Record<string, AISuggestion[]>
  >({});
  const [error, setError] = useState<string | null>(null);

  // 状態変更 (active / paused / completed / archived)
  const changeStatus = async (
    id: string,
    name: string,
    next: "active" | "paused" | "completed" | "archived",
  ) => {
    const labels: Record<string, string> = {
      active: "アクティブに戻す",
      paused: "一時停止する",
      completed: "完了にする",
      archived: "アーカイブする",
    };
    const details: Record<string, string> = {
      active:
        "プロジェクトをアクティブに戻します。ダッシュボードに表示されます。",
      paused:
        "プロジェクトを一時停止します。稼働率や連続記録に影響します。ダッシュボードには表示されます。",
      completed:
        "プロジェクトを完了扱いにします。応募・活性化案の対象外になりますが、閲覧はできます。",
      archived:
        "プロジェクトをアーカイブします。組織内のプロジェクト一覧から見えなくなります。データは残るので後から復元可能です。",
    };
    if (!confirm(`「${name}」を${labels[next]}?\n\n${details[next]}`)) return;

    setChangingStatusId(id);
    setError(null);
    const { error: err } = await supabase
      .from("projects")
      .update({ status: next } as never)
      .eq("id", id);
    setChangingStatusId(null);
    if (err) {
      setError(`状態変更に失敗しました: ${err.message}`);
      return;
    }
    router.refresh();
  };

  const deleteProject = async (id: string, name: string) => {
    const phrase = `${name} を削除`;
    const input = window.prompt(
      `プロジェクト「${name}」を削除します。\n\n` +
        "関連するタスク・実行計画・WBS・収支・診断・チャット履歴など全データが削除されます。元に戻せません。\n\n" +
        `続行するには「${phrase}」と入力してください。`,
    );
    if (input !== phrase) {
      if (input !== null) {
        alert("入力が一致しませんでした。削除を中止しました。");
      }
      return;
    }
    setDeletingId(id);
    setError(null);
    const { error: err } = await supabase
      .from("projects")
      .delete()
      .eq("id", id);
    setDeletingId(null);
    if (err) {
      setError(`削除に失敗しました: ${err.message}`);
      return;
    }
    router.refresh();
  };

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
                    href={`/${orgSlug}/projects/${p.id}/dashboard`}
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
                  {/* 状態変更 (管理者) */}
                  {canDelete && p.status !== "archived" && (
                    <>
                      {p.status === "active" && (
                        <button
                          type="button"
                          onClick={() => changeStatus(p.id, p.name, "paused")}
                          disabled={changingStatusId === p.id}
                          className="rounded-md bg-white border border-line px-2.5 py-1 text-[11px] font-semibold text-mute hover:text-ink disabled:opacity-50"
                          title="一時停止 (稼働率に影響)"
                        >
                          {changingStatusId === p.id ? "..." : "⏸ 停止"}
                        </button>
                      )}
                      {(p.status === "paused" ||
                        p.status === "completed") && (
                        <button
                          type="button"
                          onClick={() => changeStatus(p.id, p.name, "active")}
                          disabled={changingStatusId === p.id}
                          className="rounded-md bg-white border border-line px-2.5 py-1 text-[11px] font-semibold text-mute hover:text-ink disabled:opacity-50"
                          title="アクティブに戻す"
                        >
                          {changingStatusId === p.id ? "..." : "▶ 再開"}
                        </button>
                      )}
                      {p.status !== "completed" && (
                        <button
                          type="button"
                          onClick={() =>
                            changeStatus(p.id, p.name, "completed")
                          }
                          disabled={changingStatusId === p.id}
                          className="rounded-md bg-white border border-line px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          title="完了扱いにする"
                        >
                          {changingStatusId === p.id ? "..." : "✅ 完了"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => changeStatus(p.id, p.name, "archived")}
                        disabled={changingStatusId === p.id}
                        className="rounded-md bg-white border border-line px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                        title="アーカイブ (一覧から非表示・後から復元可)"
                      >
                        {changingStatusId === p.id ? "..." : "🗄 アーカイブ"}
                      </button>
                    </>
                  )}
                  {canDelete && p.status === "archived" && (
                    <button
                      type="button"
                      onClick={() => changeStatus(p.id, p.name, "active")}
                      disabled={changingStatusId === p.id}
                      className="rounded-md bg-white border border-line px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                      title="アーカイブから復元"
                    >
                      {changingStatusId === p.id ? "..." : "▶ 復元"}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => deleteProject(p.id, p.name)}
                      disabled={deletingId === p.id}
                      className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-mute hover:bg-red-50 hover:text-error disabled:opacity-50"
                      title="プロジェクトを完全削除 (取消不可)"
                    >
                      {deletingId === p.id ? "..." : "🗑 削除"}
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
