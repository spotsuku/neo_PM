"use client";

import { useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { HexRadar } from "@/components/ui/HexRadar";
import { Sparkline } from "@/components/ui/Sparkline";
import { StatusDot } from "@/components/ui/StatusDot";
import { ProjectPicker } from "@/components/projects/ProjectPicker";
import {
  DIAG_ITEMS,
  MAX_PER_ITEM,
  MAX_TOTAL,
  categorize,
  mondayOf,
  tierLabel,
  totalScore,
  type DiagKey,
  type DiagScores,
} from "@/lib/diag-items";
import type { Database } from "@/lib/types/database";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Entry = Database["public"]["Tables"]["diagnosis_entries"]["Row"];
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
  initialEntries: Entry[];
}

const VALUE_LABEL: Record<number, string> = {
  0: "×",
  1: "△未満",
  2: "△",
  3: "○",
};

export function DiagBoard({
  orgSlug,
  projects,
  current,
  initialEntries,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [error, setError] = useState<string | null>(null);

  const latest = entries[0] ?? null;
  const scores = (latest?.scores ?? {}) as DiagScores;
  const [draft, setDraft] = useState<DiagScores>(scores);
  // 編集モード: 最新エントリーが今週なら「編集」、違えば「今週の評価を入力」
  const thisMonday = mondayOf(new Date());
  const editingExisting =
    latest?.week_start === thisMonday;
  const [editing, setEditing] = useState(!latest);

  const total = totalScore(editing ? draft : scores);
  const tier = tierLabel(total);
  const cats = categorize(editing ? draft : scores);

  // 直近5エントリーの合計推移
  const trend = useMemo(() => {
    const last = entries.slice(0, 5).reverse();
    return last.map((e) => totalScore((e.scores ?? {}) as DiagScores));
  }, [entries]);

  const setItem = (k: DiagKey, v: number) =>
    setDraft((prev) => ({ ...prev, [k]: v }));

  const startEditing = () => {
    setDraft(scores);
    setEditing(true);
  };

  const cancelEditing = () => {
    setDraft(scores);
    setEditing(false);
  };

  const saveEntry = async () => {
    if (editingExisting && latest) {
      const { data, error: err } = await supabase
        .from("diagnosis_entries")
        .update({ scores: draft })
        .eq("id", latest.id)
        .select()
        .single();
      if (err || !data) {
        setError(err?.message ?? "保存に失敗しました");
        return;
      }
      setEntries((prev) => [data, ...prev.slice(1)]);
    } else {
      const { data, error: err } = await supabase
        .from("diagnosis_entries")
        .insert({
          project_id: current.id,
          week_start: thisMonday,
          scores: draft,
        })
        .select()
        .single();
      if (err || !data) {
        setError(err?.message ?? "保存に失敗しました");
        return;
      }
      setEntries((prev) => [data, ...prev]);
    }
    setEditing(false);
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
            🔍
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-[18px] font-extrabold tracking-tight truncate">
                {current.name} の診断レポート
              </h1>
              <StatusDot status={current.status} />
            </div>
            <div className="t-cap truncate">
              14項目評価・週次トラッキング ・ {entries.length} 件の履歴
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <button
              type="button"
              onClick={startEditing}
              className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white hover:opacity-90"
            >
              {latest ? "✏️ 今週の評価を編集" : "✦ 最初の評価を入力"}
            </button>
          )}
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

      {/* 上段: HexRadar + スコア / 週次推移 */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4 lg:gap-5">
        <GlassCard className="p-5 flex items-center gap-4">
          <div className="flex-shrink-0">
            <HexRadar
              data={DIAG_ITEMS.map((it) => ({
                k: it.label,
                v: (editing ? draft : scores)[it.key] ?? 0,
              }))}
              size={260}
              max={MAX_PER_ITEM}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="t-label mb-1">総合スコア</div>
            <div className="flex items-baseline gap-2 mb-2">
              <span
                className="t-big"
                style={{ fontSize: 46, lineHeight: 1 }}
              >
                {total}
              </span>
              <span className="t-cap"> / {MAX_TOTAL}</span>
            </div>
            <div className="mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-[11px] font-bold text-white">
                {"★".repeat(tier.stars).padEnd(3, "☆")} {tier.label}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <Stat label="強み" value={cats.strong} color="var(--ok)" />
              <Stat label="注意" value={cats.caution} color="var(--warn)" />
              <Stat
                label="要支援"
                value={cats.needsSupport}
                color="var(--error)"
              />
            </div>
            {trend.length >= 2 && (
              <div className="rounded-lg bg-accent-soft/50 px-3 py-2">
                <div className="t-label mb-0.5">直近の変化</div>
                <div className="text-[13px] font-bold">
                  {trend[trend.length - 1] - trend[0] >= 0 ? "+" : ""}
                  {trend[trend.length - 1] - trend[0]} 点（
                  {trend.length}週で）
                </div>
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="t-h3 mb-3">
            <span aria-hidden className="mr-2">
              📈
            </span>
            週次推移
          </h3>
          {trend.length === 0 ? (
            <div className="t-cap text-center py-10">
              評価を入力すると推移が表示されます
            </div>
          ) : (
            <WeeklyTrend values={trend} max={MAX_TOTAL} />
          )}
        </GlassCard>
      </div>

      {/* 14項目テーブル または 入力モード */}
      {editing ? (
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="t-h3">
              <span aria-hidden className="mr-2">
                ✦
              </span>
              今週の評価
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelEditing}
                className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-medium text-mute border border-line"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={saveEntry}
                className="rounded-lg bg-ink px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90"
              >
                💾 保存
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {DIAG_ITEMS.map((it) => (
              <div
                key={it.key}
                className="grid grid-cols-[1fr_auto] gap-2 items-center rounded-lg bg-white border border-line-soft px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold">{it.label}</div>
                  <div className="t-cap leading-tight truncate">
                    {it.desc}
                  </div>
                </div>
                <div className="inline-flex rounded-lg bg-canvas-2 p-0.5">
                  {[0, 1, 2, 3].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setItem(it.key, v)}
                      className={
                        "px-2.5 py-1 rounded text-[11px] font-bold transition " +
                        ((draft[it.key] ?? 0) === v
                          ? "bg-ink text-white"
                          : "text-mute hover:text-ink")
                      }
                    >
                      {VALUE_LABEL[v]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="p-5">
          <h3 className="t-h3 mb-3">
            <span aria-hidden className="mr-2">
              📋
            </span>
            14項目ドリルダウン
          </h3>
          {!latest ? (
            <div className="t-cap text-center py-10">
              「最初の評価を入力」から始めましょう
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="grid grid-cols-[1fr_72px_80px_56px] gap-2 px-3 py-2 t-label">
                <span>項目</span>
                <span className="text-center">評価</span>
                <span>推移</span>
                <span className="text-right">変化</span>
              </div>
              {DIAG_ITEMS.map((it) => {
                const value = scores[it.key] ?? 0;
                const series = entries
                  .slice(0, 4)
                  .reverse()
                  .map(
                    (e) =>
                      ((e.scores ?? {}) as DiagScores)[it.key] ?? 0,
                  );
                const delta =
                  series.length >= 2
                    ? series[series.length - 1] - series[0]
                    : 0;
                return (
                  <div
                    key={it.key}
                    className="grid grid-cols-[1fr_72px_80px_56px] gap-2 px-3 py-2 items-center border-t border-line-soft hover:bg-accent-soft/30"
                  >
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-semibold">
                        {it.label}
                      </div>
                      <div className="t-cap leading-tight truncate">
                        {it.desc}
                      </div>
                    </div>
                    <div className="text-center">
                      <ValueChip v={value} />
                    </div>
                    <div className="flex items-center">
                      {series.length >= 2 ? (
                        <Sparkline arr={series} w={70} h={18} max={MAX_PER_ITEM} />
                      ) : (
                        <span className="t-cap">—</span>
                      )}
                    </div>
                    <div
                      className="text-right t-mono text-[11px] font-semibold"
                      style={{
                        color:
                          delta > 0
                            ? "var(--ok)"
                            : delta < 0
                              ? "var(--error)"
                              : "var(--mute)",
                      }}
                    >
                      {delta > 0 ? "+" : ""}
                      {delta}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-white/70 p-2">
      <div className="t-label mb-0.5">{label}</div>
      <div
        className="t-mono text-[17px] font-bold"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}

function ValueChip({ v }: { v: number }) {
  const map: Record<number, { label: string; color: string }> = {
    0: { label: "×", color: "var(--error)" },
    1: { label: "△未満", color: "var(--warn)" },
    2: { label: "△", color: "var(--c-accent)" },
    3: { label: "○", color: "var(--ok)" },
  };
  const m = map[v] ?? map[0];
  return (
    <span
      className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
      style={{ background: m.color }}
    >
      {m.label}
    </span>
  );
}

function WeeklyTrend({
  values,
  max,
}: {
  values: number[];
  max: number;
}) {
  const W = 240;
  const H = 130;
  const padX = 18;
  const padY = 18;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const pts = values.map((v, i) => {
    const x = padX + (innerW * i) / Math.max(1, values.length - 1);
    const y = padY + innerH - (v / max) * innerH;
    return { x, y, v };
  });
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <line
        x1={padX}
        y1={H - padY}
        x2={W - padX}
        y2={H - padY}
        stroke="rgba(150,170,200,.4)"
      />
      <polyline
        points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke="var(--c-accent)"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="var(--c-accent)" />
          <text
            x={p.x}
            y={p.y - 8}
            textAnchor="middle"
            fontSize={10}
            fontWeight={700}
            fill="var(--ink)"
          >
            {p.v}
          </text>
          <text
            x={p.x}
            y={H - 4}
            textAnchor="middle"
            fontSize={9}
            fill="var(--mute)"
          >
            {i === pts.length - 1 ? "今週" : `${pts.length - 1 - i}週前`}
          </text>
        </g>
      ))}
    </svg>
  );
}
