"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";

// ── データモデル (breakeven_plans.data に JSON 保存) ─────────────
export interface BePhase {
  id: string;
  name: string;
  months: number;
  goal: string; // 狙い (一言)
  gate: string; // 達成条件 (次ラウンドへのゲート)
}
export interface BeRevenue {
  id: string;
  name: string;
  unitPrice: number; // 単価
  unitVarCost: number; // 単位変動費 (原価)
  byPhase: Record<string, { startQty: number }>; // 月あたりの販売数
  priceNote?: string; // 単価(売上)の構成・根拠
  costNote?: string; // 原価の構成・根拠
  qtyNote?: string; // 販売数の構成・根拠
}
export interface BeFixed {
  id: string;
  name: string;
  byPhase: Record<string, number>; // 月額固定費(販管費)
}
export interface BeOneoff {
  id: string;
  name: string;
  byPhase: Record<string, number>; // 段階開始時に1度だけかかる単発費用(初期投資)
}
export interface BreakevenData {
  phases: BePhase[];
  revenues: BeRevenue[];
  fixed: BeFixed[];
  oneoff?: BeOneoff[];
}

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const yen = (n: number) =>
  `¥${Math.round(Number.isFinite(n) ? n : 0).toLocaleString("ja-JP")}`;

// ── 計算 ──────────────────────────────────────────────────
interface MonthCalc {
  index: number;
  phaseId: string;
  phaseName: string;
  monthInPhase: number;
  revenue: number;
  varCost: number;
  contribution: number;
  fixed: number;
  invest: number; // 段階開始月の単発費用(初期投資)
  op: number; // 営業利益(投資込み)
  cum: number; // 累計損益
}

function calcMonths(data: BreakevenData): MonthCalc[] {
  const months: MonthCalc[] = [];
  let cum = 0;
  let idx = 0;
  for (const ph of data.phases) {
    const n = Math.max(0, Math.floor(ph.months || 0));
    for (let m = 0; m < n; m++) {
      let revenue = 0;
      let varCost = 0;
      for (const r of data.revenues) {
        const pp = r.byPhase[ph.id] ?? { startQty: 0 };
        const qty = pp.startQty || 0;
        revenue += (r.unitPrice || 0) * qty;
        varCost += (r.unitVarCost || 0) * qty;
      }
      const contribution = revenue - varCost;
      let fixed = 0;
      for (const f of data.fixed) fixed += f.byPhase[ph.id] ?? 0;
      // 単発費用(初期投資)は段階の初月(m===0)に一度だけ計上
      let invest = 0;
      if (m === 0) {
        for (const o of data.oneoff ?? []) invest += o.byPhase[ph.id] ?? 0;
      }
      const op = contribution - fixed - invest;
      cum += op;
      months.push({
        index: idx,
        phaseId: ph.id,
        phaseName: ph.name,
        monthInPhase: m,
        revenue,
        varCost,
        contribution,
        fixed,
        invest,
        op,
        cum,
      });
      idx++;
    }
  }
  return months;
}

interface Props {
  projectId: string;
  projectName: string;
  initialData: BreakevenData;
}

export function BreakevenModel({ projectId, initialData }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<BreakevenData>(() => ({
    phases: initialData.phases ?? [],
    revenues: (initialData.revenues ?? []).map((r) => ({
      ...r,
      byPhase: r.byPhase ?? {},
    })),
    fixed: (initialData.fixed ?? []).map((f) => ({
      ...f,
      byPhase: f.byPhase ?? {},
    })),
    oneoff: (initialData.oneoff ?? []).map((o) => ({
      ...o,
      byPhase: o.byPhase ?? {},
    })),
  }));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set());
  const toggleNote = (id: string) =>
    setOpenNotes((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaveState("saving");
    const t = setTimeout(async () => {
      const { error } = await supabase.from("breakeven_plans").upsert(
        {
          project_id: projectId,
          data: data as never,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id" },
      );
      setSaveState(error ? "idle" : "saved");
    }, 800);
    return () => clearTimeout(t);
  }, [data, projectId, supabase]);

  const months = useMemo(() => calcMonths(data), [data]);

  const monthlyBE = months.find((m) => m.revenue > 0 && m.op >= 0);
  const cumBE = months.find((m) => m.cum >= 0 && m.revenue > 0);
  const lastMonth = months.length > 0 ? months[months.length - 1] : null;

  // ── mutations ──
  const addPhase = () =>
    setData((d) => ({
      ...d,
      phases: [
        ...d.phases,
        {
          id: uid(),
          name: `段階${d.phases.length + 1}`,
          months: 6,
          goal: "",
          gate: "",
        },
      ],
    }));
  const patchPhase = (id: string, patch: Partial<BePhase>) =>
    setData((d) => ({
      ...d,
      phases: d.phases.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  const removePhase = (id: string) =>
    setData((d) => ({
      ...d,
      phases: d.phases.filter((p) => p.id !== id),
    }));

  const addRevenue = () =>
    setData((d) => ({
      ...d,
      revenues: [
        ...d.revenues,
        {
          id: uid(),
          name: "売上ライン",
          unitPrice: 0,
          unitVarCost: 0,
          byPhase: {},
        },
      ],
    }));
  const patchRevenue = (id: string, patch: Partial<BeRevenue>) =>
    setData((d) => ({
      ...d,
      revenues: d.revenues.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  const patchRevenuePhase = (
    id: string,
    phaseId: string,
    patch: Partial<{ startQty: number }>,
  ) =>
    setData((d) => ({
      ...d,
      revenues: d.revenues.map((r) => {
        if (r.id !== id) return r;
        const cur = r.byPhase[phaseId] ?? { startQty: 0 };
        return { ...r, byPhase: { ...r.byPhase, [phaseId]: { ...cur, ...patch } } };
      }),
    }));
  const removeRevenue = (id: string) =>
    setData((d) => ({ ...d, revenues: d.revenues.filter((r) => r.id !== id) }));

  const addFixed = () =>
    setData((d) => ({
      ...d,
      fixed: [...d.fixed, { id: uid(), name: "固定費", byPhase: {} }],
    }));
  const patchFixed = (id: string, patch: Partial<BeFixed>) =>
    setData((d) => ({
      ...d,
      fixed: d.fixed.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  const patchFixedPhase = (id: string, phaseId: string, v: number) =>
    setData((d) => ({
      ...d,
      fixed: d.fixed.map((f) =>
        f.id === id ? { ...f, byPhase: { ...f.byPhase, [phaseId]: v } } : f,
      ),
    }));
  const removeFixed = (id: string) =>
    setData((d) => ({ ...d, fixed: d.fixed.filter((f) => f.id !== id) }));

  const addOneoff = () =>
    setData((d) => ({
      ...d,
      oneoff: [
        ...(d.oneoff ?? []),
        { id: uid(), name: "初期費用", byPhase: {} },
      ],
    }));
  const patchOneoff = (id: string, patch: Partial<BeOneoff>) =>
    setData((d) => ({
      ...d,
      oneoff: (d.oneoff ?? []).map((o) =>
        o.id === id ? { ...o, ...patch } : o,
      ),
    }));
  const patchOneoffPhase = (id: string, phaseId: string, v: number) =>
    setData((d) => ({
      ...d,
      oneoff: (d.oneoff ?? []).map((o) =>
        o.id === id ? { ...o, byPhase: { ...o.byPhase, [phaseId]: v } } : o,
      ),
    }));
  const removeOneoff = (id: string) =>
    setData((d) => ({
      ...d,
      oneoff: (d.oneoff ?? []).filter((o) => o.id !== id),
    }));

  if (data.phases.length === 0) {
    return (
      <GlassCard className="p-8 text-center">
        <h3 className="t-h3 mb-2">📈 黒字化モデル</h3>
        <p className="t-cap mb-4 leading-relaxed">
          段階（例: 段階1 = 9ヶ月でPMF検証、段階2 = 6ヶ月で拡大、段階3 = 黒字化）を作り、
          単価×数量−変動費−固定費を月ごとに積み上げて黒字化月を自動算出します。
        </p>
        <button
          type="button"
          onClick={addPhase}
          className="rounded-full bg-ink px-5 py-2 text-[12.5px] font-semibold text-white hover:opacity-90"
        >
          ＋ 段階を追加
        </button>
      </GlassCard>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* サマリー */}
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="t-h3">📈 黒字化モデル</h3>
          <span className="t-cap">
            {saveState === "saving"
              ? "保存中…"
              : saveState === "saved"
                ? "✓ 保存しました"
                : ""}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Summary
            label="単月黒字化"
            value={monthlyBE ? `${monthlyBE.index + 1}ヶ月目` : "未達"}
            sub={monthlyBE ? monthlyBE.phaseName : "営業利益が黒字になる月"}
            ok={!!monthlyBE}
          />
          <Summary
            label="累積黒字化"
            value={cumBE ? `${cumBE.index + 1}ヶ月目` : "未達"}
            sub={cumBE ? cumBE.phaseName : "累計損益がプラスになる月"}
            ok={!!cumBE}
          />
          <Summary
            label="計画期間"
            value={`${months.length}ヶ月`}
            sub={`${data.phases.length} 段階`}
          />
          <Summary
            label="最終月の営業利益"
            value={lastMonth ? yen(lastMonth.op) : "—"}
            sub={lastMonth ? `累計 ${yen(lastMonth.cum)}` : ""}
            ok={lastMonth ? lastMonth.op >= 0 : undefined}
          />
        </div>
      </GlassCard>

      {/* 使い方 */}
      <GlassCard className="p-4" style={{ background: "rgba(91,141,239,.06)" }}>
        <h3 className="t-h3 mb-1.5">📘 使い方（黒字化モデルとは）</h3>
        <p className="t-cap leading-relaxed mb-2">
          「いつ黒字になるか」を 単価×数量 から自動計算する表です。下の3つを埋めると、
          一番下に月ごとの損益と黒字化する月が自動で出ます。
        </p>
        <ol className="t-cap leading-relaxed list-decimal pl-5 space-y-1">
          <li>
            <b>段階</b>：事業を時間で区切った「段階」。例: ①検証 → ②拡大 → ③黒字化。
            段階ごとに前提を変えられます。分けないなら1つ（例: 6ヶ月）でOK。
          </li>
          <li>
            <b>売上ライン</b>：何を売って稼ぐか（商品ごとに1行）。
            「単価（売値）」「原価（1個あたり）」と、各段階の
            「販売数（毎月売れる数）」を入れる。
          </li>
          <li>
            <b>固定費</b>：売上に関係なく毎月かかる費用。例: 人件費・家賃・ツール代。
            段階ごとの月額を入れる。
          </li>
          <li>
            <b>初期投資・単発費用</b>：段階の開始月に1度だけかかる投資。
            例: 初期開発費・機材購入・初期広告。その段階初月の損益に計上される。
          </li>
        </ol>
        <p className="t-cap mt-2 opacity-80">
          迷ったら、まず売上ライン1本（単価と初月の数量だけ）＋固定費1本だけでも試せます。
        </p>
      </GlassCard>

      {/* 段階 */}
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="t-h3">🚩 段階（事業の段階）</h3>
          <button
            type="button"
            onClick={addPhase}
            className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold hover:bg-mute/5"
          >
            ＋ 段階
          </button>
        </div>
        <p className="t-cap mb-3 leading-relaxed">
          事業を時間で区切った「段階」です。例: ①お試し検証 3ヶ月 → ②本格展開 6ヶ月 → ③黒字化 3ヶ月。
          段階ごとに売上の伸び・固定費・初期投資の前提を変えられます。
          <b>分ける必要がなければ段階は1つ（例: 6ヶ月）のままでOK。</b>
          各段階の「期間(月)」の合計が計画全体の長さになります。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.phases.map((p, i) => (
            <div
              key={p.id}
              className="rounded-xl border border-line-soft p-3 bg-white/70"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-soft text-[11px] font-bold text-[--c-accent-deep]">
                  {i + 1}
                </span>
                <input
                  value={p.name}
                  onChange={(e) => patchPhase(p.id, { name: e.target.value })}
                  className="flex-1 min-w-0 bg-white border border-line-soft rounded px-2 py-1 text-[13px] font-bold outline-none focus:border-[--c-accent]"
                />
                <button
                  type="button"
                  onClick={() => removePhase(p.id)}
                  className="text-mute hover:text-error text-[12px]"
                >
                  ✕
                </button>
              </div>
              <label className="flex items-center gap-2 mb-2">
                <span className="t-label whitespace-nowrap">期間(月)</span>
                <input
                  type="number"
                  value={p.months === 0 ? "" : p.months}
                  placeholder="0"
                  onChange={(e) =>
                    patchPhase(p.id, { months: Number(e.target.value) || 0 })
                  }
                  className="w-20 bg-amber-50/60 border border-line-soft rounded px-2 py-1 text-[12px] text-right outline-none focus:border-[--c-accent]"
                />
              </label>
              <textarea
                value={p.goal}
                placeholder="狙い（例: 最小コストで売上が立つか検証）"
                rows={2}
                onChange={(e) => patchPhase(p.id, { goal: e.target.value })}
                className="w-full bg-white border border-line-soft rounded px-2 py-1 text-[12px] outline-none focus:border-[--c-accent] resize-none mb-1.5"
              />
              <input
                value={p.gate}
                placeholder="達成条件（次の調達ゲート）"
                onChange={(e) => patchPhase(p.id, { gate: e.target.value })}
                className="w-full bg-white border border-line-soft rounded px-2 py-1 text-[11.5px] outline-none focus:border-[--c-accent]"
              />
            </div>
          ))}
        </div>
      </GlassCard>

      {/* 前提: 売上ライン */}
      <GlassCard className="p-0 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-line-soft">
          <h3 className="t-h3">💴 売上ライン（単価×数量）</h3>
          <button
            type="button"
            onClick={addRevenue}
            className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold hover:bg-mute/5"
          >
            ＋ 売上ライン
          </button>
        </div>
        <p className="t-cap px-3 pt-2">
          何を売って稼ぐか。商品・サービスごとに1行。例: 月額プラン / 単発販売 / 物販。
        </p>
        <div className="overflow-x-auto">
          <table className="border-collapse text-[12px] min-w-full">
            <thead>
              <tr className="bg-canvas-2 text-left">
                <th className="p-2 font-semibold min-w-[130px]">名称</th>
                <th className="p-2 font-semibold text-right">
                  単価(円)
                  <div className="t-cap font-normal">売値 / 1個</div>
                </th>
                <th className="p-2 font-semibold text-right">
                  原価(円)
                  <div className="t-cap font-normal">1個あたり</div>
                </th>
                {data.phases.map((p) => (
                  <th
                    key={p.id}
                    className="p-2 font-semibold text-center border-l border-line"
                  >
                    {data.phases.length > 1 ? `${p.name} の販売数` : "販売数"}
                    <div className="t-cap font-normal">毎月（一定）</div>
                  </th>
                ))}
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.revenues.length === 0 && (
                <tr>
                  <td
                    colSpan={4 + data.phases.length}
                    className="p-4 text-center t-cap"
                  >
                    売上ラインを追加してください（例: 月額プラン、単発販売 など）
                  </td>
                </tr>
              )}
              {data.revenues.map((r) => {
                const hasNote = !!(r.priceNote || r.costNote || r.qtyNote);
                const noteOpen = openNotes.has(r.id);
                return (
                  <Fragment key={r.id}>
                    <tr className="border-t border-line-soft">
                      <td className="p-1">
                        <div className="flex items-center gap-1">
                          <input
                            value={r.name}
                            placeholder="例: 月額プラン"
                            onChange={(e) =>
                              patchRevenue(r.id, { name: e.target.value })
                            }
                            className="w-full bg-transparent font-medium outline-none focus:bg-mute/5 rounded px-1 py-1"
                          />
                          <button
                            type="button"
                            onClick={() => toggleNote(r.id)}
                            title="売上・原価・販売数の根拠を書く"
                            className={
                              "flex-shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold " +
                              (noteOpen || hasNote
                                ? "bg-accent-soft text-[--c-accent-deep]"
                                : "text-mute hover:bg-mute/10")
                            }
                          >
                            📝 根拠
                          </button>
                        </div>
                      </td>
                      <td className="p-1">
                        <Num
                          value={r.unitPrice}
                          onChange={(v) => patchRevenue(r.id, { unitPrice: v })}
                        />
                      </td>
                      <td className="p-1">
                        <Num
                          value={r.unitVarCost}
                          onChange={(v) =>
                            patchRevenue(r.id, { unitVarCost: v })
                          }
                        />
                      </td>
                      {data.phases.map((p) => {
                        const pp = r.byPhase[p.id] ?? { startQty: 0 };
                        return (
                          <td
                            key={p.id}
                            className="p-1 border-l border-line"
                          >
                            <Num
                              value={pp.startQty}
                              onChange={(v) =>
                                patchRevenuePhase(r.id, p.id, { startQty: v })
                              }
                            />
                            <div className="t-cap text-center mt-0.5 leading-tight">
                              売上 {yen((r.unitPrice || 0) * (pp.startQty || 0))}
                              <br />
                              粗利{" "}
                              {yen(
                                ((r.unitPrice || 0) - (r.unitVarCost || 0)) *
                                  (pp.startQty || 0),
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeRevenue(r.id)}
                          className="text-mute hover:text-error"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                    {noteOpen && (
                      <tr className="bg-mute/5">
                        <td
                          colSpan={4 + data.phases.length}
                          className="p-3"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <NoteField
                              label="💴 売上(単価)の根拠・構成"
                              value={r.priceNote ?? ""}
                              onChange={(v) =>
                                patchRevenue(r.id, { priceNote: v })
                              }
                              placeholder="例: 月額1,980円。競合は2,500円だが初期は割安で獲得"
                            />
                            <NoteField
                              label="🧾 原価の根拠・構成"
                              value={r.costNote ?? ""}
                              onChange={(v) =>
                                patchRevenue(r.id, { costNote: v })
                              }
                              placeholder="例: サーバ¥200 + 決済手数料3.6% + サポート¥100"
                            />
                            <NoteField
                              label="📦 販売数の根拠・構成"
                              value={r.qtyNote ?? ""}
                              onChange={(v) =>
                                patchRevenue(r.id, { qtyNote: v })
                              }
                              placeholder="例: 毎月50件は◯◯チャネルの見込み。根拠…"
                            />
                          </div>
                          <p className="t-cap mt-1.5 opacity-70">
                            ※ 初期は前提が変わりやすいので、数字の根拠を残しておくと見直しが楽です。
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="t-cap p-3 opacity-70">
          ※ 売上＝単価×販売数、粗利＝（単価−原価）×販売数。販売数はその段階の間、毎月一定として計算します。
        </p>
      </GlassCard>

      {/* 前提: 固定費 */}
      <GlassCard className="p-0 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-line-soft">
          <h3 className="t-h3">🏢 固定費（販管費・月額）</h3>
          <button
            type="button"
            onClick={addFixed}
            className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold hover:bg-mute/5"
          >
            ＋ 固定費
          </button>
        </div>
        <p className="t-cap px-3 pt-2">
          売上に関係なく毎月かかる費用。段階ごとの月額を入れます。例: 人件費 / 家賃 / ツール代。
        </p>
        <div className="overflow-x-auto">
          <table className="border-collapse text-[12px] min-w-full">
            <thead>
              <tr className="bg-canvas-2 text-left">
                <th className="p-2 font-semibold min-w-[130px]">名称</th>
                {data.phases.map((p) => (
                  <th
                    key={p.id}
                    className="p-2 font-semibold text-right border-l border-line"
                  >
                    {p.name}
                  </th>
                ))}
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.fixed.length === 0 && (
                <tr>
                  <td
                    colSpan={2 + data.phases.length}
                    className="p-4 text-center t-cap"
                  >
                    固定費を追加してください（例: 人件費、家賃、ツール費 など）。段階1は極小に置くのが定石です。
                  </td>
                </tr>
              )}
              {data.fixed.map((f) => (
                <tr key={f.id} className="border-t border-line-soft">
                  <td className="p-1">
                    <input
                      value={f.name}
                      placeholder="例: 人件費"
                      onChange={(e) => patchFixed(f.id, { name: e.target.value })}
                      className="w-full bg-transparent font-medium outline-none focus:bg-mute/5 rounded px-1 py-1"
                    />
                  </td>
                  {data.phases.map((p) => (
                    <td key={p.id} className="p-1 border-l border-line">
                      <Num
                        value={f.byPhase[p.id] ?? 0}
                        onChange={(v) => patchFixedPhase(f.id, p.id, v)}
                      />
                    </td>
                  ))}
                  <td className="p-1 text-center">
                    <button
                      type="button"
                      onClick={() => removeFixed(f.id)}
                      className="text-mute hover:text-error"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* 初期投資・単発費用 */}
      <GlassCard className="p-0 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-line-soft">
          <h3 className="t-h3">💸 初期投資・単発費用（段階開始時に1度）</h3>
          <button
            type="button"
            onClick={addOneoff}
            className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold hover:bg-mute/5"
          >
            ＋ 単発費用
          </button>
        </div>
        <p className="t-cap px-3 pt-2">
          各段階の開始月に1度だけかかる投資。例: 初期開発費・機材購入・登記・初期広告。
          入れた額はその段階の初月の損益に計上されます。
        </p>
        <div className="overflow-x-auto">
          <table className="border-collapse text-[12px] min-w-full">
            <thead>
              <tr className="bg-canvas-2 text-left">
                <th className="p-2 font-semibold min-w-[130px]">名称</th>
                {data.phases.map((p) => (
                  <th
                    key={p.id}
                    className="p-2 font-semibold text-right border-l border-line"
                  >
                    {p.name}
                    <div className="t-cap font-normal">開始時に1度(円)</div>
                  </th>
                ))}
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {(data.oneoff ?? []).length === 0 && (
                <tr>
                  <td
                    colSpan={2 + data.phases.length}
                    className="p-4 text-center t-cap"
                  >
                    単発の投資があれば追加してください（例: 初期開発費 50万、機材 20万 など）。
                  </td>
                </tr>
              )}
              {(data.oneoff ?? []).map((o) => (
                <tr key={o.id} className="border-t border-line-soft">
                  <td className="p-1">
                    <input
                      value={o.name}
                      placeholder="例: 初期開発費"
                      onChange={(e) => patchOneoff(o.id, { name: e.target.value })}
                      className="w-full bg-transparent font-medium outline-none focus:bg-mute/5 rounded px-1 py-1"
                    />
                  </td>
                  {data.phases.map((p) => (
                    <td key={p.id} className="p-1 border-l border-line">
                      <Num
                        value={o.byPhase[p.id] ?? 0}
                        onChange={(v) => patchOneoffPhase(o.id, p.id, v)}
                      />
                    </td>
                  ))}
                  <td className="p-1 text-center">
                    <button
                      type="button"
                      onClick={() => removeOneoff(o.id)}
                      className="text-mute hover:text-error"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* 月次プロジェクション */}
      <GlassCard className="p-0 min-w-0 overflow-hidden">
        <div className="p-3 border-b border-line-soft">
          <h3 className="t-h3">📅 月次プロジェクション</h3>
        </div>
        <div className="overflow-auto max-h-[60vh]">
          <table className="border-collapse text-[12px] w-full">
            <thead>
              <tr className="text-right sticky top-0 z-10">
                <th className="sticky left-0 z-20 bg-canvas-2 p-2 text-left">月</th>
                <th className="bg-canvas-2 p-2">売上</th>
                <th className="bg-canvas-2 p-2">変動費</th>
                <th className="bg-canvas-2 p-2">貢献利益</th>
                <th className="bg-canvas-2 p-2">固定費</th>
                <th className="bg-canvas-2 p-2">単発投資</th>
                <th className="bg-canvas-2 p-2">営業利益</th>
                <th className="bg-canvas-2 p-2">累計損益</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m, i) => {
                const isPhaseStart =
                  i === 0 || months[i - 1].phaseId !== m.phaseId;
                return (
                  <Fragment key={m.index}>
                    {isPhaseStart && (
                      <tr className="bg-accent-soft/40">
                        <td
                          colSpan={8}
                          className="sticky left-0 p-1.5 text-left font-bold text-[11.5px] text-[--c-accent-deep]"
                        >
                          🚩 {m.phaseName}
                        </td>
                      </tr>
                    )}
                    <tr
                      className={
                        "border-t border-line-soft text-right t-mono " +
                        (m.op >= 0 && m.revenue > 0
                          ? "bg-emerald-50/50"
                          : "")
                      }
                    >
                      <td className="sticky left-0 z-[1] bg-white text-left px-2 py-1.5">
                        {m.index + 1}ヶ月
                      </td>
                      <td className="px-2 py-1.5">{yen(m.revenue)}</td>
                      <td className="px-2 py-1.5 text-mute">{yen(m.varCost)}</td>
                      <td className="px-2 py-1.5">{yen(m.contribution)}</td>
                      <td className="px-2 py-1.5 text-mute">{yen(m.fixed)}</td>
                      <td className="px-2 py-1.5 text-mute">
                        {m.invest ? yen(m.invest) : "—"}
                      </td>
                      <td
                        className={
                          "px-2 py-1.5 font-bold " +
                          (m.op >= 0 ? "text-[--positive,#1fb870]" : "text-error")
                        }
                      >
                        {yen(m.op)}
                      </td>
                      <td
                        className={
                          "px-2 py-1.5 " +
                          (m.cum >= 0 ? "" : "text-error")
                        }
                      >
                        {yen(m.cum)}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="t-cap p-3 opacity-70">
          ※ 緑の行＝その月の営業利益が黒字。累計損益がプラスに転じた月が「累積黒字化」です。
        </p>
      </GlassCard>
    </div>
  );
}

function Summary({
  label,
  value,
  sub,
  ok,
}: {
  label: string;
  value: string;
  sub?: string;
  ok?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line-soft p-3 bg-white/70">
      <div className="t-label mb-1">{label}</div>
      <div
        className="text-[20px] font-extrabold leading-none"
        style={{
          color:
            ok === undefined
              ? undefined
              : ok
                ? "var(--positive, #1fb870)"
                : "var(--error, #ff5468)",
        }}
      >
        {value}
      </div>
      {sub && <div className="t-cap mt-1 truncate">{sub}</div>}
    </div>
  );
}

function NoteField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="t-label mb-1">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-lg border border-line-soft bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent] resize-none"
      />
    </div>
  );
}

function Num({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <input
      type="number"
      value={value === 0 ? "" : value}
      placeholder="0"
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="w-full bg-amber-50/60 border border-line-soft rounded px-1.5 py-1 text-[12px] text-right outline-none focus:border-[--c-accent]"
    />
  );
}
