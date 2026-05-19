"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface Row {
  kind: "income" | "expense";
  name: string;
  amounts: number[];
}

interface BudgetData {
  months: number;
  rows: Row[];
}

interface Props {
  /** budget_plan カラムに保存される文字列 (JSON または free text) */
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}

const DEFAULT_MONTHS = 6;
const DEFAULT_INCOME = ["協賛", "補助金"];
const DEFAULT_EXPENSE = ["人件費", "機材", "広報"];

function defaultData(): BudgetData {
  const months = DEFAULT_MONTHS;
  return {
    months,
    rows: [
      ...DEFAULT_INCOME.map((name) => ({
        kind: "income" as const,
        name,
        amounts: Array.from({ length: months }, () => 0),
      })),
      ...DEFAULT_EXPENSE.map((name) => ({
        kind: "expense" as const,
        name,
        amounts: Array.from({ length: months }, () => 0),
      })),
    ],
  };
}

function parseValue(raw: string): BudgetData {
  if (!raw?.trim()) return defaultData();
  try {
    const obj = JSON.parse(raw) as Partial<BudgetData>;
    if (
      typeof obj.months !== "number" ||
      !Array.isArray(obj.rows) ||
      obj.months < 1
    ) {
      return defaultData();
    }
    const months = Math.max(1, Math.min(24, obj.months));
    const rows: Row[] = (obj.rows as unknown as Partial<Row>[])
      .filter((r): r is Partial<Row> => typeof r === "object" && r !== null)
      .map((r) => ({
        kind: r.kind === "expense" ? "expense" : "income",
        name: typeof r.name === "string" ? r.name : "項目",
        amounts: Array.from({ length: months }, (_, i) =>
          typeof r.amounts?.[i] === "number" ? r.amounts[i] : 0,
        ),
      }));
    return { months, rows };
  } catch {
    return defaultData();
  }
}

/** スプレッドシート風の収支計画グリッド。
 *  - 各セルは visible な枠線 + ホバーで accent-soft 背景
 *  - 数値は桁区切り (1,000) で表示、フォーカス時のみ raw 入力に切替
 *  - Tab / Shift+Tab で水平ナビ、Enter で次の行に進む
 *  - 内部状態は JSON.stringify して budget_plan カラムに永続化 */
export function BudgetPlanGrid({ value, onChange, disabled }: Props) {
  const [data, setData] = useState<BudgetData>(() => parseValue(value));

  useEffect(() => {
    const next = parseValue(value);
    setData(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = useCallback(
    (next: BudgetData) => {
      setData(next);
      onChange(JSON.stringify(next));
    },
    [onChange],
  );

  const updateCell = (rowIdx: number, monthIdx: number, val: number) => {
    const rows = data.rows.map((r, ri) =>
      ri === rowIdx
        ? {
            ...r,
            amounts: r.amounts.map((a, mi) => (mi === monthIdx ? val : a)),
          }
        : r,
    );
    commit({ ...data, rows });
  };

  const updateName = (rowIdx: number, name: string) => {
    const rows = data.rows.map((r, ri) =>
      ri === rowIdx ? { ...r, name } : r,
    );
    commit({ ...data, rows });
  };

  const addRow = (kind: "income" | "expense") => {
    const newRow: Row = {
      kind,
      name: kind === "income" ? "新しい収入" : "新しい支出",
      amounts: Array.from({ length: data.months }, () => 0),
    };
    commit({ ...data, rows: [...data.rows, newRow] });
  };

  const removeRow = (rowIdx: number) => {
    commit({ ...data, rows: data.rows.filter((_, ri) => ri !== rowIdx) });
  };

  const setMonths = (n: number) => {
    const months = Math.max(1, Math.min(24, n));
    const rows = data.rows.map((r) => {
      const amounts = Array.from(
        { length: months },
        (_, i) => r.amounts[i] ?? 0,
      );
      return { ...r, amounts };
    });
    commit({ months, rows });
  };

  // 集計
  const totals = useMemo(() => {
    const incomes = Array.from({ length: data.months }, (_, m) =>
      data.rows
        .filter((r) => r.kind === "income")
        .reduce((sum, r) => sum + (r.amounts[m] ?? 0), 0),
    );
    const expenses = Array.from({ length: data.months }, (_, m) =>
      data.rows
        .filter((r) => r.kind === "expense")
        .reduce((sum, r) => sum + (r.amounts[m] ?? 0), 0),
    );
    const balance = incomes.map((v, i) => v - (expenses[i] ?? 0));
    let cumulative = 0;
    const cumulativeBalance = balance.map((b) => (cumulative += b));
    return { incomes, expenses, balance, cumulativeBalance };
  }, [data]);

  const incomeRows = data.rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.kind === "income");
  const expenseRows = data.rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.kind === "expense");

  return (
    <div className="rounded-lg border border-line bg-white overflow-hidden">
      {/* ツールバー */}
      <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-b border-line text-[11.5px] bg-canvas-2/40">
        <span className="t-cap">月数</span>
        <div className="inline-flex items-center rounded-md overflow-hidden border border-line">
          <button
            type="button"
            onClick={() => setMonths(data.months - 1)}
            disabled={disabled || data.months <= 1}
            className="px-2 py-0.5 hover:bg-mute/10 disabled:opacity-30 border-r border-line bg-white"
            aria-label="月を減らす"
          >
            −
          </button>
          <span className="t-mono font-bold w-7 text-center bg-white">
            {data.months}
          </span>
          <button
            type="button"
            onClick={() => setMonths(data.months + 1)}
            disabled={disabled || data.months >= 24}
            className="px-2 py-0.5 hover:bg-mute/10 disabled:opacity-30 border-l border-line bg-white"
            aria-label="月を増やす"
          >
            ＋
          </button>
        </div>
        <span className="t-cap ml-2">単位: 万円</span>
        <span className="t-cap ml-auto opacity-70">
          Tab で次のセル / 矢印キーで上下移動
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="bg-canvas-2/70">
              <th className="px-2 py-2 text-left font-bold sticky left-0 bg-canvas-2/95 z-10 min-w-[140px] border-r border-line">
                項目
              </th>
              {Array.from({ length: data.months }, (_, m) => (
                <th
                  key={m}
                  className="px-2 py-2 text-right font-bold w-[78px] border-r border-line"
                >
                  M+{m + 1}
                </th>
              ))}
              <th className="px-2 py-2 w-[28px]" />
            </tr>
          </thead>

          {/* 収入 */}
          <tbody>
            <SectionRow
              label="💰 収入"
              cols={data.months}
            />
            {incomeRows.map(({ r, i }, ix) => (
              <DataRow
                key={i}
                rowIdx={i}
                tableRowIdx={ix}
                row={r}
                disabled={disabled}
                onName={updateName}
                onCell={updateCell}
                onRemove={removeRow}
              />
            ))}
            <TotalRow
              label="収入合計"
              values={totals.incomes}
              tone="ok"
            />
            <AddRow
              label="＋ 収入の行を追加"
              cols={data.months}
              disabled={disabled}
              onClick={() => addRow("income")}
            />
          </tbody>

          {/* 支出 */}
          <tbody>
            <SectionRow label="💸 支出" cols={data.months} />
            {expenseRows.map(({ r, i }, ix) => (
              <DataRow
                key={i}
                rowIdx={i}
                tableRowIdx={ix}
                row={r}
                disabled={disabled}
                onName={updateName}
                onCell={updateCell}
                onRemove={removeRow}
              />
            ))}
            <TotalRow
              label="支出合計"
              values={totals.expenses}
              tone="error"
            />
            <AddRow
              label="＋ 支出の行を追加"
              cols={data.months}
              disabled={disabled}
              onClick={() => addRow("expense")}
            />
          </tbody>

          {/* 残 / 累計 */}
          <tbody>
            <SignedTotalRow
              label="月次 残"
              values={totals.balance}
            />
            <SignedTotalRow
              label="累計"
              values={totals.cumulativeBalance}
              strong
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── サブコンポーネント ────────────────────────────────────────

function SectionRow({ label, cols }: { label: string; cols: number }) {
  return (
    <tr>
      <td
        colSpan={cols + 2}
        className="px-3 py-1 text-[11.5px] font-extrabold tracking-wide text-mute bg-canvas-2/30 border-y border-line"
      >
        {label}
      </td>
    </tr>
  );
}

function DataRow({
  rowIdx,
  tableRowIdx,
  row,
  disabled,
  onName,
  onCell,
  onRemove,
}: {
  rowIdx: number;
  tableRowIdx: number;
  row: Row;
  disabled?: boolean;
  onName: (rowIdx: number, name: string) => void;
  onCell: (rowIdx: number, monthIdx: number, val: number) => void;
  onRemove: (rowIdx: number) => void;
}) {
  const zebra = tableRowIdx % 2 === 0 ? "bg-white" : "bg-canvas-2/30";
  return (
    <tr className={`border-t border-line ${zebra}`}>
      <td className="sticky left-0 z-10 bg-inherit border-r border-line px-0">
        <input
          type="text"
          value={row.name}
          disabled={disabled}
          onChange={(e) => onName(rowIdx, e.target.value)}
          className="w-full bg-transparent outline-none text-[12px] font-semibold px-2 py-1.5 focus:bg-accent-soft/40"
        />
      </td>
      {row.amounts.map((amt, m) => (
        <td
          key={m}
          className="text-right border-r border-line-soft p-0 hover:bg-accent-soft/30"
        >
          <NumberCell
            value={amt}
            disabled={disabled}
            onChange={(v) => onCell(rowIdx, m, v)}
          />
        </td>
      ))}
      <td className="text-center px-1">
        <button
          type="button"
          onClick={() => onRemove(rowIdx)}
          disabled={disabled}
          aria-label="行を削除"
          className="text-mute hover:text-error text-[11px] disabled:opacity-30"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

function TotalRow({
  label,
  values,
  tone,
}: {
  label: string;
  values: number[];
  tone: "ok" | "error";
}) {
  const bg =
    tone === "ok"
      ? "bg-accent-soft/60"
      : "bg-red-50";
  const color = tone === "ok" ? "text-[--c-accent-deep]" : "text-error";
  return (
    <tr className={`border-t border-line font-extrabold ${bg}`}>
      <td
        className={`sticky left-0 px-2 py-1.5 border-r border-line ${bg}`}
      >
        {label}
      </td>
      {values.map((v, m) => (
        <td
          key={m}
          className={`px-2 py-1.5 text-right t-mono border-r border-line-soft ${color}`}
        >
          {v.toLocaleString()}
        </td>
      ))}
      <td />
    </tr>
  );
}

function SignedTotalRow({
  label,
  values,
  strong,
}: {
  label: string;
  values: number[];
  strong?: boolean;
}) {
  return (
    <tr
      className={
        "border-t border-line " +
        (strong ? "bg-canvas-2/60 font-extrabold" : "bg-canvas-2/30 font-bold")
      }
    >
      <td
        className={
          "sticky left-0 px-2 py-1.5 border-r border-line " +
          (strong ? "bg-canvas-2/95" : "bg-canvas-2/60")
        }
      >
        {label}
      </td>
      {values.map((v, m) => (
        <td
          key={m}
          className={
            "px-2 py-1.5 text-right t-mono border-r border-line-soft " +
            (v < 0 ? "text-error" : v > 0 ? "text-[var(--ok)]" : "text-mute")
          }
        >
          {v > 0 ? `+${v.toLocaleString()}` : v.toLocaleString()}
        </td>
      ))}
      <td />
    </tr>
  );
}

function AddRow({
  label,
  cols,
  disabled,
  onClick,
}: {
  label: string;
  cols: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <tr>
      <td
        colSpan={cols + 2}
        className="px-2 py-1.5 border-t border-line-soft bg-white"
      >
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className="text-[11px] font-semibold text-mute hover:text-ink disabled:opacity-30"
        >
          {label}
        </button>
      </td>
    </tr>
  );
}

/** 数値セル: フォーカスでは raw 編集、blur したら 1,000 形式に */
function NumberCell({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      value={focused ? draft : value === 0 ? "" : value.toLocaleString()}
      placeholder="0"
      disabled={disabled}
      onFocus={() => {
        setFocused(true);
        setDraft(value === 0 ? "" : String(value));
        // フォーカス時に全選択
        requestAnimationFrame(() => ref.current?.select());
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false);
        const cleaned = draft.replace(/[^\-0-9]/g, "");
        const num = cleaned === "" || cleaned === "-" ? 0 : Number(cleaned);
        onChange(Number.isFinite(num) ? num : 0);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
          // 下のセルにフォーカス (同じ列の次の行)
          const cell = (e.target as HTMLInputElement).closest("td");
          const nextRow = cell?.parentElement?.nextElementSibling;
          const cellIdx = Array.from(
            cell?.parentElement?.children ?? [],
          ).indexOf(cell as Element);
          const target = nextRow?.children?.[cellIdx]?.querySelector("input");
          (target as HTMLInputElement | null)?.focus();
        }
      }}
      className="w-full text-right bg-transparent outline-none t-mono text-[12px] px-2 py-1.5 placeholder:text-mute/40 focus:bg-accent-soft/40"
    />
  );
}
