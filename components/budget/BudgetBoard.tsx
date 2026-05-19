"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusDot } from "@/components/ui/StatusDot";
import type { Database } from "@/lib/types/database";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Item = Database["public"]["Tables"]["budget_items"]["Row"];
type ProjectStub = {
  id: string;
  name: string;
  team_name: string | null;
  status: string;
};

type Kind = "income" | "cogs" | "sga";
type Mode = "plan" | "actual";

interface MonthlyCell {
  plan?: number;
  actual?: number;
}
type MonthlyMap = Record<string, MonthlyCell>;

interface Props {
  orgSlug: string;
  projects: ProjectStub[];
  current: Project;
  initialItems: Item[];
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const yen = (n: number) => `¥${(n ?? 0).toLocaleString("ja-JP")}`;
const shortYen = (n: number) => {
  if (n === 0) return "—";
  if (Math.abs(n) >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(n);
};

const GROUPS: { kind: Kind; label: string; emo: string; tint: string }[] = [
  { kind: "income", label: "収入（売上）", emo: "📥", tint: "rgba(180,220,200,.25)" },
  { kind: "cogs",   label: "売上原価",     emo: "📤", tint: "rgba(255,209,170,.25)" },
  { kind: "sga",    label: "販管費",       emo: "📤", tint: "rgba(220,200,200,.25)" },
];

function normalizeMonthly(raw: unknown): MonthlyMap {
  if (!raw || typeof raw !== "object") return {};
  const result: MonthlyMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      result[k] = {
        plan: typeof obj.plan === "number" ? obj.plan : 0,
        actual: typeof obj.actual === "number" ? obj.actual : 0,
      };
    }
  }
  return result;
}

function monthlyTotal(map: MonthlyMap, mode: Mode): number {
  let total = 0;
  for (const k in map) total += map[k][mode] ?? 0;
  return total;
}

export function BudgetBoard({
  orgSlug,
  projects,
  current,
  initialItems,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  // legacy 'expense' を 'sga' 扱いに変換
  const [items, setItems] = useState<Item[]>(
    initialItems.map((it) =>
      it.kind === "expense" ? { ...it, kind: "sga" as const } : it,
    ),
  );
  const [mode, setMode] = useState<Mode>("plan");
  const [error, setError] = useState<string | null>(null);
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());

  // ── Supabase Realtime: 他ユーザーの変更を即時反映 ──
  useEffect(() => {
    const channel = supabase
      .channel(`budget-${current.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "budget_items",
          filter: `project_id=eq.${current.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setItems((prev) => {
              const incoming = payload.new as Item;
              return prev.some((i) => i.id === incoming.id)
                ? prev
                : [...prev, incoming];
            });
          } else if (payload.eventType === "UPDATE") {
            const incoming = payload.new as Item;
            setItems((prev) =>
              prev.map((i) => (i.id === incoming.id ? incoming : i)),
            );
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setItems((prev) => prev.filter((i) => i.id !== old.id));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, current.id]);

  // ── 集計（PL）──
  const sums = useMemo(() => {
    const byKind: Record<Kind, { plan: number; actual: number }> = {
      income: { plan: 0, actual: 0 },
      cogs: { plan: 0, actual: 0 },
      sga: { plan: 0, actual: 0 },
    };
    for (const it of items) {
      const k = (it.kind === "expense" ? "sga" : it.kind) as Kind;
      const m = normalizeMonthly(it.monthly_amounts);
      byKind[k].plan += monthlyTotal(m, "plan");
      byKind[k].actual += monthlyTotal(m, "actual");
    }
    return byKind;
  }, [items]);

  const grossProfit = {
    plan: sums.income.plan - sums.cogs.plan,
    actual: sums.income.actual - sums.cogs.actual,
  };
  const operating = {
    plan: grossProfit.plan - sums.sga.plan,
    actual: grossProfit.actual - sums.sga.actual,
  };

  // ── 月次合計（モード切替に従う、グループごと）──
  const monthlyByKind = useMemo(() => {
    const result: Record<Kind, number[]> = {
      income: new Array(12).fill(0),
      cogs: new Array(12).fill(0),
      sga: new Array(12).fill(0),
    };
    for (const it of items) {
      const k = (it.kind === "expense" ? "sga" : it.kind) as Kind;
      const m = normalizeMonthly(it.monthly_amounts);
      for (let i = 0; i < 12; i++) {
        result[k][i] += m[String(i + 1)]?.[mode] ?? 0;
      }
    }
    return result;
  }, [items, mode]);

  const addItem = async (kind: Kind) => {
    const defaultCat: Record<Kind, string> = {
      income: "NEO基金",
      cogs: "外注費",
      sga: "会場・設営",
    };
    const defaultName: Record<Kind, string> = {
      income: "新規収入",
      cogs: "新規原価",
      sga: "新規販管費",
    };
    const { data, error: err } = await supabase
      .from("budget_items")
      .insert({
        project_id: current.id,
        kind,
        category: defaultCat[kind],
        name: defaultName[kind],
        plan_jpy: 0,
        actual_jpy: 0,
        monthly_amounts: {},
      })
      .select()
      .single();
    if (err || !data) {
      setError(err?.message ?? "追加に失敗しました");
      return;
    }
    // realtime echo が来るので局所追加は重複しないように
    setItems((prev) =>
      prev.some((i) => i.id === data.id) ? prev : [...prev, data],
    );
  };

  const updateItemMeta = async (id: string, patch: Partial<Item>) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
    const { error: err } = await supabase
      .from("budget_items")
      .update(patch as never)
      .eq("id", id);
    if (err) setError(err.message);
  };

  const removeItem = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await supabase.from("budget_items").delete().eq("id", id);
  };

  const updateCell = async (
    item: Item,
    monthIndex0: number,
    value: number,
  ) => {
    const monthKey = String(monthIndex0 + 1);
    const cellId = `${item.id}:${monthKey}:${mode}`;
    setSavingCells((prev) => new Set(prev).add(cellId));
    const current = normalizeMonthly(item.monthly_amounts);
    const next: MonthlyMap = {
      ...current,
      [monthKey]: {
        plan: mode === "plan" ? value : current[monthKey]?.plan ?? 0,
        actual: mode === "actual" ? value : current[monthKey]?.actual ?? 0,
      },
    };
    // 行合計も計算してまとめて save
    const planTotal = monthlyTotal(next, "plan");
    const actualTotal = monthlyTotal(next, "actual");
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              monthly_amounts: next as never,
              plan_jpy: planTotal,
              actual_jpy: actualTotal,
            }
          : i,
      ),
    );
    const { error: err } = await supabase
      .from("budget_items")
      .update({
        monthly_amounts: next as never,
        plan_jpy: planTotal,
        actual_jpy: actualTotal,
      })
      .eq("id", item.id);
    setSavingCells((prev) => {
      const s = new Set(prev);
      s.delete(cellId);
      return s;
    });
    if (err) setError(err.message);
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
            💴
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-[18px] font-extrabold tracking-tight truncate">
                {current.name} の収支計画
              </h1>
              <StatusDot status={current.status} />
            </div>
            <div className="t-cap truncate">
              月次PL（売上 - 原価 - 販管費 = 営業利益）・セル単位リアルタイム同期
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-full bg-white p-1 shadow-[0_1px_0_var(--line-soft)] text-[11px] font-semibold">
            {(["plan", "actual"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={
                  "px-3 py-1.5 rounded-full transition " +
                  (mode === m
                    ? m === "plan"
                      ? "bg-ink text-white"
                      : "bg-[--c-accent] text-white"
                    : "text-mute hover:text-ink")
                }
              >
                {m === "plan" ? "📋 計画" : "✓ 実績"}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* PL サマリー */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <PLSummary
          label="売上"
          plan={sums.income.plan}
          actual={sums.income.actual}
          mode={mode}
        />
        <PLSummary
          label="売上原価"
          plan={sums.cogs.plan}
          actual={sums.cogs.actual}
          mode={mode}
          negative
        />
        <PLSummary
          label="売上総利益"
          plan={grossProfit.plan}
          actual={grossProfit.actual}
          mode={mode}
          highlight
        />
        <PLSummary
          label="販管費"
          plan={sums.sga.plan}
          actual={sums.sga.actual}
          mode={mode}
          negative
        />
        <PLSummary
          label="営業利益"
          plan={operating.plan}
          actual={operating.actual}
          mode={mode}
          highlight
          critical
        />
      </div>

      {/* グループごとの月次グリッド */}
      {GROUPS.map((g) => {
        const groupItems = items.filter(
          (i) => (i.kind === "expense" ? "sga" : i.kind) === g.kind,
        );
        const monthlyTotals = monthlyByKind[g.kind];
        const rowTotal = monthlyTotals.reduce((a, b) => a + b, 0);
        return (
          <GlassCard key={g.kind} className="p-0 overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between bg-canvas-2 border-b border-line-soft">
              <h3 className="t-h3 flex items-center gap-2">
                <span aria-hidden>{g.emo}</span>
                <span>{g.label}</span>
                <span className="t-cap font-normal">
                  {groupItems.length} 件
                </span>
              </h3>
              <button
                type="button"
                onClick={() => addItem(g.kind)}
                className="rounded-full bg-ink px-3 py-1 text-[11px] font-semibold text-white hover:opacity-90"
              >
                ＋ {g.label}を追加
              </button>
            </div>
            <div className="overflow-x-auto">
              <table
                className="min-w-full text-[11.5px] border-collapse"
                style={{ background: g.tint }}
              >
                <thead>
                  <tr className="t-label">
                    <th
                      className="text-left px-3 py-2 sticky left-0 z-10"
                      style={{
                        background: g.tint,
                        minWidth: 160,
                        maxWidth: 220,
                      }}
                    >
                      項目
                    </th>
                    <th
                      className="text-left px-2 py-2 sticky z-10"
                      style={{
                        background: g.tint,
                        left: 160,
                        minWidth: 100,
                      }}
                    >
                      カテゴリ
                    </th>
                    {MONTHS.map((m) => (
                      <th
                        key={m}
                        className="text-right px-1.5 py-2"
                        style={{ minWidth: 64 }}
                      >
                        {m}月
                      </th>
                    ))}
                    <th
                      className="text-right px-2 py-2 font-bold"
                      style={{ minWidth: 80 }}
                    >
                      合計
                    </th>
                    <th style={{ width: 28 }} />
                  </tr>
                </thead>
                <tbody>
                  {groupItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={MONTHS.length + 4}
                        className="text-center py-4 text-mute"
                      >
                        まだ項目がありません
                      </td>
                    </tr>
                  ) : (
                    groupItems.map((it) => (
                      <ItemRow
                        key={it.id}
                        item={it}
                        mode={mode}
                        groupTint={g.tint}
                        savingCells={savingCells}
                        onUpdateMeta={(p) => updateItemMeta(it.id, p)}
                        onUpdateCell={(mi, v) => updateCell(it, mi, v)}
                        onRemove={() => removeItem(it.id)}
                      />
                    ))
                  )}
                  {/* 月別合計行 */}
                  <tr className="border-t-2 border-ink/20 font-bold">
                    <td
                      className="text-left px-3 py-2 sticky left-0 z-10"
                      style={{ background: g.tint }}
                    >
                      合計
                    </td>
                    <td
                      className="sticky z-10"
                      style={{ background: g.tint, left: 160 }}
                    />
                    {monthlyTotals.map((v, i) => (
                      <td
                        key={i}
                        className="text-right px-1.5 py-2 t-mono"
                      >
                        {v === 0 ? "—" : shortYen(v)}
                      </td>
                    ))}
                    <td className="text-right px-2 py-2 t-mono">
                      {yen(rowTotal)}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </GlassCard>
        );
      })}

      <GlassCard variant="dark" className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="grid h-7 w-7 place-items-center rounded-full text-white text-[13px]"
            style={{
              background:
                "conic-gradient(from 220deg, var(--c-accent), var(--c-accent-deep) 60%, #0a0a0a)",
            }}
          >
            ✦
          </span>
          <div className="text-[13px] font-bold">NEO.ai の観察</div>
        </div>
        <p className="text-[12.5px] leading-relaxed opacity-90">
          {operating.actual < 0
            ? "営業利益が赤字です。販管費の見直しか、基金申請 / 協賛増額を検討しましょう。"
            : grossProfit.actual < grossProfit.plan * 0.5 && grossProfit.plan > 0
              ? "売上総利益が計画の半分以下です。原価構造を見直しましょう。"
              : sums.income.plan === 0
                ? "収入項目をまだ入れていません。「＋ 収入を追加」から NEO 基金や協賛の見込み額を入れていきましょう。"
                : "順調です。計画 vs 実績の差異が大きい月は AI 添削を活用して原因を整理してください。"}
        </p>
      </GlassCard>
    </div>
  );
}

function PLSummary({
  label,
  plan,
  actual,
  mode,
  negative = false,
  highlight = false,
  critical = false,
}: {
  label: string;
  plan: number;
  actual: number;
  mode: Mode;
  negative?: boolean;
  highlight?: boolean;
  critical?: boolean;
}) {
  const v = mode === "plan" ? plan : actual;
  const sub = mode === "plan" ? `実績 ${yen(actual)}` : `計画 ${yen(plan)}`;
  let color = "var(--ink)";
  if (critical) color = v < 0 ? "var(--error)" : "var(--ok)";
  else if (highlight) color = "var(--c-accent-deep)";
  else if (negative) color = "var(--warn)";
  return (
    <GlassCard className="p-4">
      <div className="t-label mb-1">{label}</div>
      <div className="t-big" style={{ fontSize: 20, color }}>
        {yen(v)}
      </div>
      <div className="t-cap mt-1">{sub}</div>
    </GlassCard>
  );
}

interface ItemRowProps {
  item: Item;
  mode: Mode;
  groupTint: string;
  savingCells: Set<string>;
  onUpdateMeta: (patch: Partial<Item>) => void;
  onUpdateCell: (monthIndex0: number, value: number) => void;
  onRemove: () => void;
}

function ItemRow({
  item,
  mode,
  groupTint,
  savingCells,
  onUpdateMeta,
  onUpdateCell,
  onRemove,
}: ItemRowProps) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category ?? "");
  useEffect(() => {
    setName(item.name);
    setCategory(item.category ?? "");
  }, [item.id, item.name, item.category]);

  const monthly = normalizeMonthly(item.monthly_amounts);
  const rowTotal = monthlyTotal(monthly, mode);

  return (
    <tr className="border-t border-line-soft/60">
      <td
        className="px-3 py-1.5 sticky left-0 z-10"
        style={{ background: groupTint, minWidth: 160 }}
      >
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== item.name && onUpdateMeta({ name })}
          className="w-full bg-transparent text-[12px] font-medium outline-none rounded px-1 py-0.5 hover:bg-white focus:bg-white"
        />
      </td>
      <td
        className="px-2 py-1.5 sticky z-10"
        style={{ background: groupTint, left: 160 }}
      >
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          onBlur={() =>
            category !== (item.category ?? "") &&
            onUpdateMeta({ category: category || null })
          }
          placeholder="—"
          className="w-full bg-transparent text-[11px] outline-none rounded px-1 py-0.5 hover:bg-white focus:bg-white"
        />
      </td>
      {MONTHS.map((m, i) => {
        const val = monthly[String(m)]?.[mode] ?? 0;
        const cellId = `${item.id}:${m}:${mode}`;
        const saving = savingCells.has(cellId);
        return (
          <Cell
            key={m}
            value={val}
            saving={saving}
            onCommit={(v) => onUpdateCell(i, v)}
          />
        );
      })}
      <td className="text-right px-2 py-1.5 t-mono text-[12px] font-semibold">
        {yen(rowTotal)}
      </td>
      <td className="px-1 py-1.5 text-center">
        <button
          type="button"
          onClick={onRemove}
          aria-label="削除"
          className="grid h-5 w-5 place-items-center text-mute hover:text-error hover:bg-red-50 rounded"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

function Cell({
  value,
  saving,
  onCommit,
}: {
  value: number;
  saving: boolean;
  onCommit: (v: number) => void;
}) {
  const [local, setLocal] = useState<string>(String(value || ""));
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement | null>(null);
  // 外部からの value 変化（realtime 含む）を反映、ただしフォーカス中は守る
  useEffect(() => {
    if (!focused) setLocal(value ? String(value) : "");
  }, [value, focused]);

  const commit = () => {
    const cleaned = local.replace(/[^\d-]/g, "");
    const n = cleaned === "" || cleaned === "-" ? 0 : parseInt(cleaned, 10);
    if (n !== value) onCommit(n);
  };

  return (
    <td
      className="text-right px-0.5 py-1"
      style={{ minWidth: 64 }}
    >
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onFocus={(e) => {
          setFocused(true);
          e.currentTarget.select();
        }}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setLocal(value ? String(value) : "");
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="—"
        className={
          "w-full text-right rounded bg-transparent px-1 py-0.5 t-mono text-[11px] outline-none transition " +
          (focused
            ? "bg-white ring-2 ring-[--c-accent]"
            : "hover:bg-white") +
          (saving ? " opacity-50" : "")
        }
      />
    </td>
  );
}
