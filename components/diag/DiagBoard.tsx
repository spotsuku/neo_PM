"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  tierLabel,
  totalScore,
  type DiagKey,
  type DiagScores,
} from "@/lib/diag-items";
import { todayISO } from "@/lib/dates";
import type { Database } from "@/lib/types/database";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Entry = Database["public"]["Tables"]["diagnosis_entries"]["Row"];
type ProjectStub = {
  id: string;
  name: string;
  team_name: string | null;
  status: string;
};

interface Member {
  user_id: string;
  role: "lead" | "member";
  display_name: string | null;
}

interface Props {
  orgSlug: string;
  projects: ProjectStub[];
  current: Project;
  currentUserId: string | null;
  members: Member[];
  initialEntries: Entry[];
}

const VALUE_LABEL: Record<number, string> = {
  0: "×",
  1: "△未満",
  2: "△",
  3: "○",
};

type ViewMode = "team" | "self" | "members";

export function DiagBoard({
  orgSlug,
  projects,
  current,
  currentUserId,
  members,
  initialEntries,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  // デフォルトは「自分」: チーム平均では下の 14 評価項目が非表示なので
  // 入力導線が分かりにくい。自分タブからスタートして入力を促す。
  const [mode, setMode] = useState<ViewMode>("self");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(
    currentUserId,
  );
  const [error, setError] = useState<string | null>(null);

  // ─── 各ユーザーの「最新エントリー」を計算 ──────────
  const latestByUser = useMemo(() => {
    const map = new Map<string, Entry>();
    for (const e of entries) {
      if (!e.user_id) continue;
      const prev = map.get(e.user_id);
      if (!prev || (prev.entry_date ?? "") < (e.entry_date ?? "")) {
        map.set(e.user_id, e);
      }
    }
    return map;
  }, [entries]);

  // ─── 自分の "今日のドラフト" entry を取得 or 作成 ──
  // 今日付の自分のエントリーがあればそれを使う、無ければ「最新の自分のエントリー」を継続編集用に
  const myTodayEntry = useMemo(() => {
    if (!currentUserId) return null;
    const today = todayISO();
    for (const e of entries) {
      if (e.user_id === currentUserId && e.entry_date === today) return e;
    }
    return null;
  }, [entries, currentUserId]);

  const myLatestEntry = useMemo(() => {
    if (!currentUserId) return null;
    return latestByUser.get(currentUserId) ?? null;
  }, [latestByUser, currentUserId]);

  // 自分の入力中ドラフト（保存ボタンを押すまでサーバーには送らない）
  const baseScores = useMemo<DiagScores>(() => {
    return (myTodayEntry?.scores ?? myLatestEntry?.scores ?? {}) as DiagScores;
  }, [myTodayEntry, myLatestEntry]);
  const [draft, setDraft] = useState<DiagScores>(baseScores);
  const [draftBaseId, setDraftBaseId] = useState<string | null>(
    myTodayEntry?.id ?? null,
  );
  // baseScores が変わった (= 他ユーザーの編集を realtime で受け取った 等) ら同期
  useEffect(() => {
    // 自分の今日エントリーの id が変わったときだけ draft を上書き
    const currentId = myTodayEntry?.id ?? null;
    if (currentId !== draftBaseId) {
      setDraft(baseScores);
      setDraftBaseId(currentId);
    }
  }, [myTodayEntry?.id, baseScores, draftBaseId]);

  // 未保存判定
  const dirty = useMemo(() => {
    for (const it of DIAG_ITEMS) {
      if ((draft[it.key] ?? null) !== (baseScores[it.key] ?? null)) return true;
    }
    return false;
  }, [draft, baseScores]);
  const filledCount = DIAG_ITEMS.filter(
    (it) => draft[it.key] !== undefined,
  ).length;
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // ─── チーム平均 ─────────────────────────────────
  const teamAverage = useMemo<DiagScores>(() => {
    const contributors = Array.from(latestByUser.values());
    if (contributors.length === 0) return {};
    const sum: Record<string, number> = {};
    for (const e of contributors) {
      const s = (e.scores ?? {}) as DiagScores;
      for (const it of DIAG_ITEMS) {
        sum[it.key] = (sum[it.key] ?? 0) + (s[it.key] ?? 0);
      }
    }
    const avg: DiagScores = {};
    for (const it of DIAG_ITEMS) {
      avg[it.key] = sum[it.key] / contributors.length;
    }
    return avg;
  }, [latestByUser]);

  // ─── 選択中メンバーの最新 ────────────────────────
  const selectedMember = members.find((m) => m.user_id === selectedMemberId);
  const selectedMemberLatest = selectedMemberId
    ? latestByUser.get(selectedMemberId) ?? null
    : null;
  const selectedMemberScores = (selectedMemberLatest?.scores ?? {}) as DiagScores;

  // ─── 表示中の scores（HexRadar 用）────────────────
  const displayedScores = useMemo<DiagScores>(() => {
    if (mode === "team") return teamAverage;
    if (mode === "self") return draft;
    return selectedMemberScores;
  }, [mode, teamAverage, draft, selectedMemberScores]);

  // ─── 自分の評価入力（保存ボタンで明示的に upsert）─────
  const setMyItem = (k: DiagKey, v: number) => {
    // ローカル draft 更新のみ。保存は別ボタン。
    setDraft((prev) => ({ ...prev, [k]: v }));
  };

  const resetDraft = () => setDraft(baseScores);

  const saveDraft = async () => {
    if (!currentUserId) return;
    setError(null);
    setSaving(true);
    const today = todayISO();
    const scoresToSave: DiagScores = {};
    for (const it of DIAG_ITEMS) {
      if (draft[it.key] !== undefined) scoresToSave[it.key] = draft[it.key];
    }

    if (myTodayEntry) {
      const { data, error: err } = await supabase
        .from("diagnosis_entries")
        .update({ scores: scoresToSave })
        .eq("id", myTodayEntry.id)
        .select()
        .single();
      if (err || !data) {
        setError(err?.message ?? "保存に失敗しました");
      } else {
        setEntries((prev) =>
          prev.map((e) => (e.id === data.id ? data : e)),
        );
        setSavedAt(Date.now());
      }
    } else {
      const { data, error: err } = await supabase
        .from("diagnosis_entries")
        .insert({
          project_id: current.id,
          user_id: currentUserId,
          entry_date: today,
          scores: scoresToSave,
        })
        .select()
        .single();
      if (err || !data) {
        setError(err?.message ?? "保存に失敗しました");
      } else {
        setEntries((prev) => [data, ...prev]);
        setDraftBaseId(data.id);
        setSavedAt(Date.now());
      }
    }
    setSaving(false);
  };

  // ─── サマリーデータ ──────────────────────────────
  const displayedTotal = totalScore(displayedScores);
  const displayedTier = tierLabel(Math.round(displayedTotal));
  const displayedCats = categorize(
    Object.fromEntries(
      Object.entries(displayedScores).map(([k, v]) => [k, Math.round(v as number)]),
    ) as DiagScores,
  );

  const recordingMembers = Array.from(latestByUser.keys());
  const recordingCount = recordingMembers.length;

  // ─── 月次推移（チーム平均の月別）────────────────
  const monthlyTrend = useMemo(() => {
    if (entries.length === 0) return [] as { month: string; total: number }[];
    const buckets: Record<string, { sum: number; userMap: Map<string, number> }> = {};
    // 各月ごとに、その月内の各ユーザーの最新を取って平均
    for (const e of entries) {
      if (!e.user_id || !e.entry_date) continue;
      const month = e.entry_date.slice(0, 7);
      if (!buckets[month]) buckets[month] = { sum: 0, userMap: new Map() };
      const prev = buckets[month].userMap.get(e.user_id);
      if (prev === undefined || prev < new Date(e.entry_date).getTime()) {
        const sc = (e.scores ?? {}) as DiagScores;
        const t = totalScore(sc);
        buckets[month].userMap.set(e.user_id, t);
      }
    }
    return Object.entries(buckets)
      .map(([month, b]) => {
        const vals = Array.from(b.userMap.values());
        const avg =
          vals.length > 0 ? vals.reduce((a, x) => a + x, 0) / vals.length : 0;
        return { month, total: avg };
      })
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [entries]);

  // ─── 各メンバーの月次推移（個人別）────────────────
  const memberMonthlyTotal = (userId: string) => {
    const userEntries = entries
      .filter((e) => e.user_id === userId)
      .sort((a, b) => (a.entry_date ?? "").localeCompare(b.entry_date ?? ""))
      .slice(-5);
    return userEntries.map((e) =>
      totalScore((e.scores ?? {}) as DiagScores),
    );
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
                {current.name} のチームワーク評価
              </h1>
              <StatusDot status={current.status} />
            </div>
            <div className="t-cap truncate">
              14項目 ・ メンバー個別記入（月次目安、書いた時に都度保存）
              ・ 記入済み {recordingCount}/{members.length} 名
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full bg-white p-1 shadow-[0_1px_0_var(--line-soft)] text-[11px] font-semibold">
            {(
              [
                ["team", "👥 チーム平均"],
                ["self", "👤 自分"],
                ["members", "📋 メンバー別"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setMode(k)}
                className={
                  "px-3 py-1.5 rounded-full transition " +
                  (mode === k
                    ? "bg-ink text-white"
                    : "text-mute hover:text-ink")
                }
              >
                {label}
              </button>
            ))}
          </div>
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

      {/* HexRadar + score */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4 lg:gap-5">
        <GlassCard className="p-5 flex items-center gap-4">
          <div className="flex-shrink-0">
            <HexRadar
              data={DIAG_ITEMS.map((it) => ({
                k: it.label,
                v: displayedScores[it.key] ?? 0,
              }))}
              size={260}
              max={MAX_PER_ITEM}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="t-label mb-1">
              {mode === "team"
                ? "チーム平均"
                : mode === "self"
                  ? "自分の最新"
                  : `${selectedMember?.display_name ?? "メンバー"}の最新`}
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span
                className="t-big"
                style={{ fontSize: 46, lineHeight: 1 }}
              >
                {Math.round(displayedTotal)}
              </span>
              <span className="t-cap"> / {MAX_TOTAL}</span>
            </div>
            <div className="mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-[11px] font-bold text-white">
                {"★".repeat(displayedTier.stars).padEnd(3, "☆")}{" "}
                {displayedTier.label}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <Stat
                label="強み"
                value={displayedCats.strong}
                color="var(--ok)"
              />
              <Stat
                label="注意"
                value={displayedCats.caution}
                color="var(--warn)"
              />
              <Stat
                label="要支援"
                value={displayedCats.needsSupport}
                color="var(--error)"
              />
            </div>
            {mode === "team" && recordingCount < members.length && (
              <div className="rounded-lg bg-accent-soft/50 px-3 py-2 t-cap">
                💡 {members.length - recordingCount} 名がまだ未記入。
                チーム平均は記入済みメンバーの最新値で計算しています。
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="t-h3 mb-3">
            <span aria-hidden className="mr-2">
              📈
            </span>
            月次推移（チーム平均）
          </h3>
          {monthlyTrend.length === 0 ? (
            <div className="t-cap text-center py-10">
              評価を入力すると推移が表示されます
            </div>
          ) : (
            <MonthlyTrend
              values={monthlyTrend.map((m) => m.total)}
              labels={monthlyTrend.map((m) => m.month.slice(2))}
              max={MAX_TOTAL}
            />
          )}
        </GlassCard>
      </div>

      {/* メインコンテンツ */}
      {mode === "self" && (
        <SelfEditor
          currentUserId={currentUserId}
          scores={draft}
          filledCount={filledCount}
          dirty={dirty}
          saving={saving}
          savedAt={savedAt}
          onChange={setMyItem}
          onReset={resetDraft}
          onSave={saveDraft}
        />
      )}

      {mode === "team" && (
        <TeamAverageTable
          teamAverage={teamAverage}
          contributorCount={recordingCount}
          memberLatest={Array.from(latestByUser.entries()).map(([uid, e]) => ({
            user_id: uid,
            display_name:
              members.find((m) => m.user_id === uid)?.display_name ?? null,
            scores: (e.scores ?? {}) as DiagScores,
          }))}
        />
      )}

      {mode === "members" && (
        <MembersTable
          members={members}
          latestByUser={latestByUser}
          selectedMemberId={selectedMemberId}
          onSelect={setSelectedMemberId}
          memberMonthlyTotal={memberMonthlyTotal}
        />
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
      <div className="t-mono text-[17px] font-bold" style={{ color }}>
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
  const m = map[Math.round(v)] ?? map[0];
  return (
    <span
      className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
      style={{ background: m.color }}
    >
      {m.label}
    </span>
  );
}

function MonthlyTrend({
  values,
  labels,
  max,
}: {
  values: number[];
  labels: string[];
  max: number;
}) {
  const W = 240;
  const H = 130;
  const padX = 18;
  const padY = 18;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  if (values.length === 0) return null;
  const pts = values.map((v, i) => {
    const x =
      values.length === 1
        ? padX + innerW / 2
        : padX + (innerW * i) / (values.length - 1);
    const y = padY + innerH - (v / max) * innerH;
    return { x, y, v, label: labels[i] };
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
      {pts.length > 1 && (
        <polyline
          points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="var(--c-accent)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      )}
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
            {Math.round(p.v)}
          </text>
          <text
            x={p.x}
            y={H - 4}
            textAnchor="middle"
            fontSize={9}
            fill="var(--mute)"
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ─── 自分の評価 入力エディタ（保存ボタンで明示的に upsert）─
function SelfEditor({
  currentUserId,
  scores,
  filledCount,
  dirty,
  saving,
  savedAt,
  onChange,
  onReset,
  onSave,
}: {
  currentUserId: string | null;
  scores: DiagScores;
  filledCount: number;
  dirty: boolean;
  saving: boolean;
  savedAt: number | null;
  onChange: (k: DiagKey, v: number) => void;
  onReset: () => void;
  onSave: () => void;
}) {
  if (!currentUserId) {
    return (
      <GlassCard className="p-6 text-center t-cap">
        ログインしてください
      </GlassCard>
    );
  }
  const justSaved = savedAt !== null && Date.now() - savedAt < 2500;
  const total = DIAG_ITEMS.length;
  const remaining = total - filledCount;
  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div>
          <h3 className="t-h3">
            <span aria-hidden className="mr-2">
              ✦
            </span>
            チームワーク評価（自分）
          </h3>
          <p className="t-cap mt-0.5">
            14項目を選んだら <strong>保存</strong> ボタンで記録（今日付のエントリーに upsert）。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="t-cap">
            {filledCount}/{total} 記入
            {remaining > 0 && <span className="text-warn"> ・ 残り {remaining}</span>}
          </span>
          {dirty && (
            <button
              type="button"
              onClick={onReset}
              disabled={saving}
              className="rounded-md bg-white border border-line px-3 py-1.5 text-[11px] font-medium text-mute hover:bg-mute/5 disabled:opacity-50"
            >
              リセット
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || saving}
            className="rounded-md bg-ink px-4 py-1.5 text-[11.5px] font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            {saving ? "💾 保存中..." : justSaved ? "✓ 保存しました" : "💾 保存"}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {DIAG_ITEMS.map((it) => {
          const isSet = scores[it.key] !== undefined;
          return (
            <div
              key={it.key}
              className={
                "grid grid-cols-[1fr_auto] gap-2 items-center rounded-lg border px-3 py-2 transition " +
                (isSet
                  ? "bg-white border-line-soft"
                  : "bg-canvas-2 border-dashed border-line")
              }
            >
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold flex items-center gap-2">
                  {it.label}
                  {!isSet && <span className="t-cap text-warn">未記入</span>}
                </div>
                <div className="t-cap leading-tight truncate">{it.desc}</div>
              </div>
              <div className="inline-flex rounded-lg bg-canvas-2 p-0.5">
                {[0, 1, 2, 3].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onChange(it.key, v)}
                    className={
                      "px-2.5 py-1 rounded text-[11px] font-bold transition " +
                      ((scores[it.key] ?? -1) === v
                        ? "bg-ink text-white"
                        : "text-mute hover:text-ink")
                    }
                  >
                    {VALUE_LABEL[v]}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {dirty && (
        <div className="mt-3 rounded-lg bg-warn/15 px-3 py-2 t-cap text-warn">
          ⚠ 未保存の変更があります。上の「💾 保存」ボタンを押して記録してください。
        </div>
      )}
    </GlassCard>
  );
}

// ─── チーム平均テーブル ─────────────────────────────────
function TeamAverageTable({
  teamAverage,
  contributorCount,
  memberLatest,
}: {
  teamAverage: DiagScores;
  contributorCount: number;
  memberLatest: {
    user_id: string;
    display_name: string | null;
    scores: DiagScores;
  }[];
}) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="t-h3">
          <span aria-hidden className="mr-2">
            📋
          </span>
          14項目 チーム平均（記入済み {contributorCount} 名）
        </h3>
      </div>
      {contributorCount === 0 ? (
        <p className="t-cap text-center py-10">
          まだ誰も評価を入力していません。「👤 自分」タブから入力を始めましょう。
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-[1fr_72px_minmax(0,200px)] gap-2 px-3 py-2 t-label">
            <span>項目</span>
            <span className="text-center">平均</span>
            <span>メンバー別の分布</span>
          </div>
          {DIAG_ITEMS.map((it) => {
            const avg = teamAverage[it.key] ?? 0;
            const memberVals = memberLatest.map((m) => ({
              name: m.display_name ?? "?",
              v: m.scores[it.key] ?? 0,
            }));
            return (
              <div
                key={it.key}
                className="grid grid-cols-[1fr_72px_minmax(0,200px)] gap-2 px-3 py-2 items-center border-t border-line-soft hover:bg-accent-soft/30"
              >
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold">{it.label}</div>
                  <div className="t-cap leading-tight truncate">{it.desc}</div>
                </div>
                <div className="text-center flex flex-col items-center gap-1">
                  <ValueChip v={avg} />
                  <span className="t-mono text-[10px] opacity-80">
                    {avg.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-end gap-1 h-9">
                  {memberVals.map((mv, i) => {
                    const h = Math.max(
                      4,
                      ((mv.v ?? 0) / MAX_PER_ITEM) * 36,
                    );
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-t-sm"
                        title={`${mv.name}: ${mv.v}`}
                        style={{
                          height: h,
                          background:
                            mv.v >= 3
                              ? "var(--ok)"
                              : mv.v >= 2
                                ? "var(--c-accent)"
                                : mv.v >= 1
                                  ? "var(--warn)"
                                  : "var(--error)",
                          opacity: mv.v === 0 ? 0.3 : 1,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}

// ─── メンバー別テーブル ─────────────────────────────────
function MembersTable({
  members,
  latestByUser,
  selectedMemberId,
  onSelect,
  memberMonthlyTotal,
}: {
  members: Member[];
  latestByUser: Map<string, Entry>;
  selectedMemberId: string | null;
  onSelect: (uid: string | null) => void;
  memberMonthlyTotal: (uid: string) => number[];
}) {
  return (
    <GlassCard className="p-5">
      <h3 className="t-h3 mb-3">
        <span aria-hidden className="mr-2">
          👥
        </span>
        メンバー別の評価
      </h3>
      {members.length === 0 ? (
        <p className="t-cap text-center py-6">
          このプロジェクトにメンバーがいません
        </p>
      ) : (
        <div className="rounded-lg overflow-hidden border border-line-soft">
          <div className="grid grid-cols-[1fr_72px_72px_72px_88px] gap-2 px-3 py-2 bg-canvas-2 t-label">
            <span>メンバー</span>
            <span className="text-center">合計</span>
            <span className="text-center">強み</span>
            <span className="text-center">要支援</span>
            <span>推移</span>
          </div>
          {members.map((m) => {
            const latest = latestByUser.get(m.user_id);
            const scores = (latest?.scores ?? {}) as DiagScores;
            const t = totalScore(scores);
            const cats = categorize(
              Object.fromEntries(
                Object.entries(scores).map(([k, v]) => [k, Math.round(v as number)]),
              ) as DiagScores,
            );
            const series = memberMonthlyTotal(m.user_id);
            const isSelected = m.user_id === selectedMemberId;
            return (
              <button
                key={m.user_id}
                type="button"
                onClick={() => onSelect(m.user_id)}
                className={
                  "w-full grid grid-cols-[1fr_72px_72px_72px_88px] gap-2 px-3 py-2 items-center border-t border-line-soft text-left transition " +
                  (isSelected
                    ? "bg-accent-soft"
                    : "hover:bg-accent-soft/30")
                }
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="grid h-7 w-7 place-items-center rounded-full text-white text-[11px] font-semibold"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
                    }}
                  >
                    {(m.display_name ?? "?")[0]}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold truncate">
                      {m.display_name ?? "（名前未設定）"}
                    </div>
                    <div className="t-cap">
                      {m.role === "lead" ? "リード" : "メンバー"}
                      {latest?.entry_date && ` ・ 最終 ${latest.entry_date}`}
                    </div>
                  </div>
                </div>
                <span className="text-center t-mono text-[15px] font-bold">
                  {latest ? Math.round(t) : "—"}
                </span>
                <span
                  className="text-center t-mono text-[13px] font-bold"
                  style={{ color: "var(--ok)" }}
                >
                  {latest ? cats.strong : "—"}
                </span>
                <span
                  className="text-center t-mono text-[13px] font-bold"
                  style={{ color: "var(--error)" }}
                >
                  {latest ? cats.needsSupport : "—"}
                </span>
                <span>
                  {series.length >= 2 ? (
                    <Sparkline arr={series} w={80} h={22} max={MAX_TOTAL} />
                  ) : (
                    <span className="t-cap">—</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
