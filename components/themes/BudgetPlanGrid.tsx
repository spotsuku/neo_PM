"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
    // JSON でない (旧 free text データ) → 空表 + 元テキストを残すために最初の
    // 行に名前として詰める。なるべくユーザーが直近の入力を失わないように。
    const data = defaultData();
    return data;
  }
}

/** 月次の収支計画をスプレッドシート形式で編集するコンポーネント。
 *  内部状態を JSON 化して onChange で親に渡す → 親が budget_plan カラムに保存。
 *  再ロード時は JSON.parse で復元されるので消えない。 */
export function BudgetPlanGrid({ value, onChange, disabled }: Props) {
  const [data, setData] = useState<BudgetData>(() => parseValue(value));

  // value が外部から更新された (初期化時など) → 同期
  useEffect(() => {
    const next = parseValue(value);
    setData(next);
    // intentionally ignore deps to avoid loop
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
    commit({
      ...data,
      rows: data.rows.filter((_, ri) => ri !== rowIdx),
    });
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

  // 集計 (month ごと)
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
    <div className="rounded-lg border border-line bg-white">
      {/* 操作行 */}
      <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-b border-line-soft text-[11.5px]">
        <span className="t-cap">月数</span>
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMonths(data.months - 1)}
            disabled={disabled || data.months <= 1}
            className="rounded-md bg-mute/10 px-2 py-0.5 hover:bg-mute/20 disabled:opacity-30"
            aria-label="月を減らす"
          >
            −
          </button>
          <span className="t-mono font-bold w-6 text-center">
            {data.months}
          </span>
          <button
            type="button"
            onClick={() => setMonths(data.months + 1)}
            disabled={disabled || data.months >= 24}
            className="rounded-md bg-mute/10 px-2 py-0.5 hover:bg-mute/20 disabled:opacity-30"
            aria-label="月を増やす"
          >
            ＋
          </button>
        </div>
        <span className="t-cap ml-2">単位: 万円</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-canvas-2/60">
            <tr>
              <th className="px-2 py-1.5 text-left font-semibold sticky left-0 bg-canvas-2/60 z-10 min-w-[140px]">
                項目
              </th>
              {Array.from({ length: data.months }, (_, m) => (
                <th
                  key={m}
                  className="px-2 py-1.5 text-right font-semibold w-[64px]"
                >
                  M+{m + 1}
                </th>
              ))}
              <th className="px-2 py-1.5 w-[28px]"></th>
            </tr>
          </thead>

          {/* 収入 */}
          <tbody>
            <tr>
              <td
                colSpan={data.months + 2}
                className="px-2 py-1 t-label bg-white border-t border-line-soft"
              >
                💰 収入
              </td>
            </tr>
            {incomeRows.map(({ r, i }) => (
              <tr key={i} className="border-t border-line-soft">
                <td className="px-2 py-1 sticky left-0 bg-white z-10">
                  <input
                    type="text"
                    value={r.name}
                    disabled={disabled}
                    onChange={(e) => updateName(i, e.target.value)}
                    className="w-full bg-transparent outline-none text-[12px] font-semibold focus:bg-accent-soft/40 rounded px-1"
                  />
                </td>
                {r.amounts.map((amt, m) => (
                  <td key={m} className="px-1 py-1 text-right">
                    <input
                      type="number"
                      value={amt}
                      disabled={disabled}
                      onChange={(e) =>
                        updateCell(i, m, Number(e.target.value) || 0)
                      }
                      className="w-full text-right bg-transparent outline-none t-mono text-[12px] focus:bg-accent-soft/40 rounded"
                    />
                  </td>
                ))}
                <td className="px-1 py-1 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    disabled={disabled}
                    aria-label="行を削除"
                    className="text-mute hover:text-error text-[12px]"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            <tr className="border-t border-line-soft bg-accent-soft/30">
              <td className="px-2 py-1 font-semibold sticky left-0 bg-accent-soft/30">
                収入合計
              </td>
              {totals.incomes.map((v, m) => (
                <td
                  key={m}
                  className="px-2 py-1 text-right t-mono font-bold"
                >
                  {v}
                </td>
              ))}
              <td />
            </tr>
            <tr>
              <td
                colSpan={data.months + 2}
                className="px-2 py-1 border-t border-line-soft"
              >
                <button
                  type="button"
                  onClick={() => addRow("income")}
                  disabled={disabled}
                  className="text-[11px] text-mute hover:text-ink"
                >
                  ＋ 収入の行を追加
                </button>
              </td>
            </tr>
          </tbody>

          {/* 支出 */}
          <tbody>
            <tr>
              <td
                colSpan={data.months + 2}
                className="px-2 py-1 t-label bg-white border-t border-line-soft"
              >
                💸 支出
              </td>
            </tr>
            {expenseRows.map(({ r, i }) => (
              <tr key={i} className="border-t border-line-soft">
                <td className="px-2 py-1 sticky left-0 bg-white z-10">
                  <input
                    type="text"
                    value={r.name}
                    disabled={disabled}
                    onChange={(e) => updateName(i, e.target.value)}
                    className="w-full bg-transparent outline-none text-[12px] font-semibold focus:bg-accent-soft/40 rounded px-1"
                  />
                </td>
                {r.amounts.map((amt, m) => (
                  <td key={m} className="px-1 py-1 text-right">
                    <input
                      type="number"
                      value={amt}
                      disabled={disabled}
                      onChange={(e) =>
                        updateCell(i, m, Number(e.target.value) || 0)
                      }
                      className="w-full text-right bg-transparent outline-none t-mono text-[12px] focus:bg-accent-soft/40 rounded"
                    />
                  </td>
                ))}
                <td className="px-1 py-1 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    disabled={disabled}
                    aria-label="行を削除"
                    className="text-mute hover:text-error text-[12px]"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            <tr className="border-t border-line-soft bg-red-50/60">
              <td className="px-2 py-1 font-semibold sticky left-0 bg-red-50/60">
                支出合計
              </td>
              {totals.expenses.map((v, m) => (
                <td
                  key={m}
                  className="px-2 py-1 text-right t-mono font-bold text-error"
                >
                  {v}
                </td>
              ))}
              <td />
            </tr>
            <tr>
              <td
                colSpan={data.months + 2}
                className="px-2 py-1 border-t border-line-soft"
              >
                <button
                  type="button"
                  onClick={() => addRow("expense")}
                  disabled={disabled}
                  className="text-[11px] text-mute hover:text-ink"
                >
                  ＋ 支出の行を追加
                </button>
              </td>
            </tr>
          </tbody>

          {/* 残 / 累計 */}
          <tbody>
            <tr className="border-t border-line-soft bg-canvas-2/40">
              <td className="px-2 py-1 font-semibold sticky left-0 bg-canvas-2/40">
                月次 残
              </td>
              {totals.balance.map((v, m) => (
                <td
                  key={m}
                  className={
                    "px-2 py-1 text-right t-mono font-bold " +
                    (v < 0 ? "text-error" : v > 0 ? "text-[var(--ok)]" : "")
                  }
                >
                  {v >= 0 ? `+${v}` : v}
                </td>
              ))}
              <td />
            </tr>
            <tr className="border-t border-line-soft bg-canvas-2/40">
              <td className="px-2 py-1 font-semibold sticky left-0 bg-canvas-2/40">
                累計
              </td>
              {totals.cumulativeBalance.map((v, m) => (
                <td
                  key={m}
                  className={
                    "px-2 py-1 text-right t-mono font-bold " +
                    (v < 0 ? "text-error" : v > 0 ? "text-[var(--ok)]" : "")
                  }
                >
                  {v >= 0 ? `+${v}` : v}
                </td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
