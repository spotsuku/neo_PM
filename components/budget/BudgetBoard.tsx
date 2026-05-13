"use client";

import { useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusDot } from "@/components/ui/StatusDot";
import { ProjectPicker } from "@/components/projects/ProjectPicker";
import type { Database } from "@/lib/types/database";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Item = Database["public"]["Tables"]["budget_items"]["Row"];
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
  initialItems: Item[];
}

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

export function BudgetBoard({
  orgSlug,
  projects,
  current,
  initialItems,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [error, setError] = useState<string | null>(null);

  const income = items.filter((i) => i.kind === "income");
  const expense = items.filter((i) => i.kind === "expense");

  const sums = useMemo(() => {
    const sum = (arr: Item[], key: "plan_jpy" | "actual_jpy") =>
      arr.reduce((s, it) => s + (it[key] ?? 0), 0);
    const incomePlan = sum(income, "plan_jpy");
    const incomeActual = sum(income, "actual_jpy");
    const expensePlan = sum(expense, "plan_jpy");
    const expenseActual = sum(expense, "actual_jpy");
    return {
      incomePlan,
      incomeActual,
      expensePlan,
      expenseActual,
      profitActual: incomeActual - expenseActual,
      profitPlan: incomePlan - expensePlan,
    };
  }, [income, expense]);

  const monthlyTotals = useMemo(() => {
    const arr = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));
    for (const i of items) {
      const m = (i.month ?? 0) - 1;
      if (m < 0 || m > 11) continue;
      if (i.kind === "income") arr[m].income += i.plan_jpy;
      else arr[m].expense += i.plan_jpy;
    }
    return arr;
  }, [items]);

  const addItem = async (kind: "income" | "expense") => {
    const { data, error: err } = await supabase
      .from("budget_items")
      .insert({
        project_id: current.id,
        kind,
        category: kind === "income" ? "NEO基金" : "会場・設営",
        name: kind === "income" ? "新規収入" : "新規支出",
        plan_jpy: 0,
        actual_jpy: 0,
      })
      .select()
      .single();
    if (err || !data) {
      setError(err?.message ?? "追加に失敗しました");
      return;
    }
    setItems((prev) => [...prev, data]);
  };

  const updateItem = async (id: string, patch: Partial<Item>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    const { error: err } = await supabase
      .from("budget_items")
      .update(patch as never)
      .eq("id", id);
    if (err) setError(err.message);
  };

  const removeItem = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    const { error: err } = await supabase
      .from("budget_items")
      .delete()
      .eq("id", id);
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
              月次PL形式・NEO基金 + 協賛 + 自己資金 / 支出計画 vs 実績
            </div>
          </div>
        </div>
        <ProjectPicker
          orgSlug={orgSlug}
          projects={projects}
          currentId={current.id}
        />
      </GlassCard>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* サマリー4枚 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Summary
          label="収入計画"
          value={sums.incomePlan}
          sub={`実績 ${yen(sums.incomeActual)}`}
        />
        <Summary
          label="収入実績"
          value={sums.incomeActual}
          sub={
            sums.incomePlan > 0
              ? `${Math.round((sums.incomeActual / sums.incomePlan) * 100)}%`
              : "—"
          }
          tone="accent"
        />
        <Summary
          label="支出実績"
          value={sums.expenseActual}
          sub={`計画 ${yen(sums.expensePlan)}`}
          tone="warn"
        />
        <Summary
          label="差引利益"
          value={sums.profitActual}
          sub={`予算上 ${yen(sums.profitPlan)}`}
          tone={sums.profitActual >= 0 ? "ok" : "error"}
        />
      </div>

      {/* テーブル + 月次推移 */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4 lg:gap-5">
        <GlassCard className="p-5">
          <GroupTable
            label="収入"
            kind="income"
            items={income}
            onAdd={() => addItem("income")}
            onUpdate={updateItem}
            onRemove={removeItem}
            tone="rgba(180,220,200,.25)"
            totals={{ plan: sums.incomePlan, actual: sums.incomeActual }}
          />
          <div className="h-px bg-line my-5" />
          <GroupTable
            label="支出"
            kind="expense"
            items={expense}
            onAdd={() => addItem("expense")}
            onUpdate={updateItem}
            onRemove={removeItem}
            tone="rgba(220,200,200,.25)"
            totals={{ plan: sums.expensePlan, actual: sums.expenseActual }}
          />
        </GlassCard>

        <div className="flex flex-col gap-4">
          <GlassCard className="p-5">
            <h3 className="t-h3 mb-3">
              <span aria-hidden className="mr-2">
                📊
              </span>
              月次推移（計画）
            </h3>
            <MonthlyChart totals={monthlyTotals} />
          </GlassCard>

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
              {sums.expenseActual > sums.incomeActual
                ? "現時点で支出実績が収入を上回っています。基金申請または協賛の打診を検討しましょう。"
                : sums.incomePlan === 0
                  ? "収入項目をまだ入れていません。「＋ 収入を追加」から NEO 基金や協賛の見込み額を入れていきましょう。"
                  : "順調です。計画 vs 実績の差異が大きい項目は AI 添削を活用して原因を整理してください。"}
            </p>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  sub,
  tone = "ink",
}: {
  label: string;
  value: number;
  sub: string;
  tone?: "ink" | "accent" | "warn" | "ok" | "error";
}) {
  const colors: Record<string, string> = {
    ink: "var(--ink)",
    accent: "var(--c-accent-deep)",
    warn: "var(--warn)",
    ok: "var(--ok)",
    error: "var(--error)",
  };
  return (
    <GlassCard className="p-4">
      <div className="t-label mb-1">{label}</div>
      <div className="t-big" style={{ fontSize: 22, color: colors[tone] }}>
        {yen(value)}
      </div>
      <div className="t-cap mt-1">{sub}</div>
    </GlassCard>
  );
}

interface GroupTableProps {
  label: string;
  kind: "income" | "expense";
  items: Item[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<Item>) => void;
  onRemove: (id: string) => void;
  tone: string;
  totals: { plan: number; actual: number };
}

function GroupTable({
  label,
  kind,
  items,
  onAdd,
  onUpdate,
  onRemove,
  tone,
  totals,
}: GroupTableProps) {
  const isIncome = kind === "income";
  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        <h3 className="t-h3">
          <span aria-hidden className="mr-2">
            {isIncome ? "📥" : "📤"}
          </span>
          {label}
        </h3>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-full bg-ink px-3 py-1 text-[11px] font-semibold text-white hover:opacity-90"
        >
          ＋ {label}を追加
        </button>
      </div>
      <div
        className="rounded-lg overflow-hidden"
        style={{ background: tone }}
      >
        <div className="grid grid-cols-[1fr_88px_72px_84px_60px_70px_28px] gap-1 px-2.5 py-1.5 t-label">
          <span>項目</span>
          <span className="text-right">カテゴリ</span>
          <span className="text-right">月</span>
          <span className="text-right">計画</span>
          <span className="text-right">実績</span>
          <span className="text-right">%</span>
          <span />
        </div>
        {items.length === 0 ? (
          <div className="t-cap text-center py-4 px-2">
            まだ項目がありません
          </div>
        ) : (
          items.map((it) => (
            <Row
              key={it.id}
              item={it}
              onUpdate={(p) => onUpdate(it.id, p)}
              onRemove={() => onRemove(it.id)}
            />
          ))
        )}
        {/* 合計行 */}
        <div className="grid grid-cols-[1fr_88px_72px_84px_60px_70px_28px] gap-1 px-2.5 py-1.5 border-t-2 border-ink/20 text-[12px] font-bold">
          <span>合計</span>
          <span />
          <span />
          <span className="text-right t-mono">{yen(totals.plan)}</span>
          <span className="text-right t-mono">{yen(totals.actual)}</span>
          <span className="text-right t-mono">
            {totals.plan > 0
              ? `${Math.round((totals.actual / totals.plan) * 100)}%`
              : "—"}
          </span>
          <span />
        </div>
      </div>
    </div>
  );
}

function Row({
  item,
  onUpdate,
  onRemove,
}: {
  item: Item;
  onUpdate: (patch: Partial<Item>) => void;
  onRemove: () => void;
}) {
  const [local, setLocal] = useState({
    name: item.name,
    category: item.category ?? "",
    month: item.month ?? 0,
    plan_jpy: item.plan_jpy,
    actual_jpy: item.actual_jpy,
    is_pending: item.is_pending,
  });
  const commit = () =>
    onUpdate({
      name: local.name,
      category: local.category || null,
      month: local.month || null,
      plan_jpy: local.plan_jpy,
      actual_jpy: local.actual_jpy,
      is_pending: local.is_pending,
    });

  const pct =
    local.plan_jpy > 0
      ? Math.round((local.actual_jpy / local.plan_jpy) * 100)
      : 0;
  const pctColor =
    pct >= 80 ? "var(--ok)" : pct >= 50 ? "var(--warn)" : "var(--mute)";

  return (
    <div className="grid grid-cols-[1fr_88px_72px_84px_60px_70px_28px] gap-1 px-2.5 py-1.5 hover:bg-white/40">
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={local.name}
          onChange={(e) => setLocal((s) => ({ ...s, name: e.target.value }))}
          onBlur={commit}
          className="flex-1 min-w-0 rounded bg-transparent px-1 py-0.5 text-[12px] outline-none hover:bg-white focus:bg-white"
        />
        {local.is_pending && (
          <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[9px] font-semibold text-[--c-accent-deep] whitespace-nowrap">
            未確定
          </span>
        )}
      </div>
      <input
        type="text"
        value={local.category}
        onChange={(e) =>
          setLocal((s) => ({ ...s, category: e.target.value }))
        }
        onBlur={commit}
        placeholder="—"
        className="text-right rounded bg-transparent px-1 py-0.5 text-[11px] outline-none hover:bg-white focus:bg-white"
      />
      <input
        type="number"
        min={0}
        max={12}
        value={local.month}
        onChange={(e) =>
          setLocal((s) => ({
            ...s,
            month: parseInt(e.target.value || "0", 10),
          }))
        }
        onBlur={commit}
        className="text-right t-mono rounded bg-transparent px-1 py-0.5 text-[11px] outline-none hover:bg-white focus:bg-white"
      />
      <input
        type="number"
        min={0}
        value={local.plan_jpy}
        onChange={(e) =>
          setLocal((s) => ({
            ...s,
            plan_jpy: parseInt(e.target.value || "0", 10),
          }))
        }
        onBlur={commit}
        className="text-right t-mono rounded bg-transparent px-1 py-0.5 text-[11px] outline-none hover:bg-white focus:bg-white"
      />
      <input
        type="number"
        min={0}
        value={local.actual_jpy}
        onChange={(e) =>
          setLocal((s) => ({
            ...s,
            actual_jpy: parseInt(e.target.value || "0", 10),
          }))
        }
        onBlur={commit}
        className="text-right t-mono rounded bg-transparent px-1 py-0.5 text-[11px] font-bold outline-none hover:bg-white focus:bg-white"
      />
      <span
        className="text-right t-mono text-[11px] font-semibold self-center"
        style={{ color: pctColor }}
      >
        {local.plan_jpy > 0 ? `${pct}%` : "—"}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="削除"
        className="self-center grid h-5 w-5 place-items-center text-mute hover:text-error hover:bg-red-50 rounded"
      >
        ✕
      </button>
    </div>
  );
}

function MonthlyChart({
  totals,
}: {
  totals: { income: number; expense: number }[];
}) {
  const max = Math.max(
    1,
    ...totals.flatMap((t) => [t.income, t.expense]),
  );
  const W = 280;
  const H = 130;
  const BAR_W = W / totals.length / 2 - 1;
  return (
    <svg width={W} height={H + 20} viewBox={`0 0 ${W} ${H + 20}`}>
      {totals.map((t, i) => {
        const x = (W / totals.length) * i;
        const incH = (t.income / max) * H;
        const expH = (t.expense / max) * H;
        const future = false;
        const opacity = future ? 0.5 : 1;
        return (
          <g key={i} opacity={opacity}>
            <rect
              x={x + 2}
              y={H - incH}
              width={BAR_W}
              height={incH}
              fill="var(--c-accent)"
              rx={2}
            />
            <rect
              x={x + 2 + BAR_W + 2}
              y={H - expH}
              width={BAR_W}
              height={expH}
              fill="var(--warn)"
              rx={2}
            />
            <text
              x={x + W / totals.length / 2}
              y={H + 12}
              textAnchor="middle"
              fontSize={9}
              fill="var(--mute)"
            >
              {i + 1}月
            </text>
          </g>
        );
      })}
    </svg>
  );
}
