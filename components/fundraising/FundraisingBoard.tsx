"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";

// ── データモデル (cap_tables.data に JSON で保存) ──────────────
export type CapGroup = "stable" | "employee" | "public" | "ipo_sell";

export interface CapAlloc {
  common: number; // 割当株数 (顕在株) — そのラウンドでの新規割当
  potential: number; // 割当株数 (潜在株)
}
export interface CapRound {
  id: string;
  name: string; // 設立第1期 / 株式譲渡 / IPO or 売却 ...
  means: string; // 手段・メモ
  startDate: string; // 時期(開始) YYYY-MM-DD
  endDate: string; // 時期(終了) YYYY-MM-DD
  issueAmount: number; // 発行価額(円)・SO行使払込金(円) — そのラウンドの調達総額
  capital: number; // 資本金・資本準備金(円)
}
export interface CapShareholder {
  id: string;
  name: string;
  group: CapGroup;
  kind: string; // 区分 (個人/法人/VC など・任意)
  note: string; // メモ (任意)
  alloc: Record<string, CapAlloc>; // roundId -> 割当
}
export interface CapData {
  rounds: CapRound[];
  shareholders: CapShareholder[];
}

const GROUPS: { key: CapGroup; label: string }[] = [
  { key: "stable", label: "安定株主" },
  { key: "employee", label: "社員株主 / 信託SO" },
  { key: "public", label: "公募" },
  { key: "ipo_sell", label: "IPO売り出し" },
];
const GROUP_LABEL: Record<CapGroup, string> = {
  stable: "安定株主",
  employee: "社員株主 / 信託SO",
  public: "公募",
  ipo_sell: "IPO売り出し",
};

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const fmt = (n: number) =>
  Number.isFinite(n) ? Math.round(n).toLocaleString("ja-JP") : "0";
const yen = (n: number) => `¥${fmt(n)}`;
const pct = (n: number) =>
  `${(Number.isFinite(n) ? n * 100 : 0).toFixed(1)}%`;

// ── 計算 ──────────────────────────────────────────────────
interface RoundCalc {
  round: CapRound;
  newCommon: number;
  newPotential: number;
  issuedCommon: number;
  issuedPotential: number;
  issuedTotal: number;
  price: number; // 想定株価
  postValue: number; // Post時価総額
  raised: number; // 資金調達額
  cumRaised: number; // 資金調達額累計
  soRatio: number;
  // shId -> holdings
  hold: Record<
    string,
    {
      common: number;
      potential: number;
      total: number;
      shareCommon: number;
      shareTotal: number;
    }
  >;
}

function calc(data: CapData): RoundCalc[] {
  const out: RoundCalc[] = [];
  let cumRaised = 0;
  // 各株主の累積保有
  const cumCommon: Record<string, number> = {};
  const cumPotential: Record<string, number> = {};
  for (const sh of data.shareholders) {
    cumCommon[sh.id] = 0;
    cumPotential[sh.id] = 0;
  }
  for (const round of data.rounds) {
    let newCommon = 0;
    let newPotential = 0;
    for (const sh of data.shareholders) {
      const a = sh.alloc[round.id] ?? { common: 0, potential: 0 };
      newCommon += a.common || 0;
      newPotential += a.potential || 0;
      cumCommon[sh.id] += a.common || 0;
      cumPotential[sh.id] += a.potential || 0;
    }
    const issuedCommon = data.shareholders.reduce(
      (s, sh) => s + cumCommon[sh.id],
      0,
    );
    const issuedPotential = data.shareholders.reduce(
      (s, sh) => s + cumPotential[sh.id],
      0,
    );
    const issuedTotal = issuedCommon + issuedPotential;
    const price = newCommon > 0 ? round.issueAmount / newCommon : 0;
    const postValue = price * issuedTotal;
    const raised = round.issueAmount || 0;
    cumRaised += raised;
    const soRatio = issuedTotal > 0 ? issuedPotential / issuedTotal : 0;
    const hold: RoundCalc["hold"] = {};
    for (const sh of data.shareholders) {
      const c = cumCommon[sh.id];
      const p = cumPotential[sh.id];
      hold[sh.id] = {
        common: c,
        potential: p,
        total: c + p,
        shareCommon: issuedCommon > 0 ? c / issuedCommon : 0,
        shareTotal: issuedTotal > 0 ? (c + p) / issuedTotal : 0,
      };
    }
    out.push({
      round,
      newCommon,
      newPotential,
      issuedCommon,
      issuedPotential,
      issuedTotal,
      price,
      postValue,
      raised,
      cumRaised,
      soRatio,
      hold,
    });
  }
  return out;
}

interface Props {
  projectId: string;
  projectName: string;
  initialData: CapData;
}

export function FundraisingBoard({
  projectId,
  projectName,
  initialData,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<"cap" | "registry">("cap");
  const [data, setData] = useState<CapData>(() => ({
    rounds: (initialData.rounds ?? []).map((r) => ({
      ...r,
      means: r.means ?? "",
      startDate: r.startDate ?? "",
      endDate: r.endDate ?? "",
    })),
    shareholders: (initialData.shareholders ?? []).map((s) => ({
      ...s,
      kind: s.kind ?? "",
      note: s.note ?? "",
      alloc: s.alloc ?? {},
    })),
  }));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const firstRender = useRef(true);

  // 自動保存 (デバウンス)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveState("saving");
    const t = setTimeout(async () => {
      const { error } = await supabase
        .from("cap_tables")
        .upsert(
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

  const rc = useMemo(() => calc(data), [data]);

  // ── mutate helpers ──
  const patchRound = (id: string, patch: Partial<CapRound>) =>
    setData((d) => ({
      ...d,
      rounds: d.rounds.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  const addRound = () =>
    setData((d) => ({
      ...d,
      rounds: [
        ...d.rounds,
        {
          id: uid(),
          name: `第${d.rounds.length + 1}ラウンド`,
          means: "",
          startDate: "",
          endDate: "",
          issueAmount: 0,
          capital: 0,
        },
      ],
    }));
  const removeRound = (id: string) =>
    setData((d) => ({
      ...d,
      rounds: d.rounds.filter((r) => r.id !== id),
      shareholders: d.shareholders.map((s) => {
        const alloc = { ...s.alloc };
        delete alloc[id];
        return { ...s, alloc };
      }),
    }));

  const patchSh = (id: string, patch: Partial<CapShareholder>) =>
    setData((d) => ({
      ...d,
      shareholders: d.shareholders.map((s) =>
        s.id === id ? { ...s, ...patch } : s,
      ),
    }));
  const patchAlloc = (
    shId: string,
    roundId: string,
    patch: Partial<CapAlloc>,
  ) =>
    setData((d) => ({
      ...d,
      shareholders: d.shareholders.map((s) => {
        if (s.id !== shId) return s;
        const cur = s.alloc[roundId] ?? { common: 0, potential: 0 };
        return { ...s, alloc: { ...s.alloc, [roundId]: { ...cur, ...patch } } };
      }),
    }));
  const addShareholder = (group: CapGroup) =>
    setData((d) => ({
      ...d,
      shareholders: [
        ...d.shareholders,
        {
          id: uid(),
          name: "新しい株主",
          group,
          kind: "",
          note: "",
          alloc: {},
        },
      ],
    }));
  const removeShareholder = (id: string) =>
    setData((d) => ({
      ...d,
      shareholders: d.shareholders.filter((s) => s.id !== id),
    }));

  return (
    <div className="flex flex-col gap-4">
      {/* ヘッダー + サブタブ */}
      <GlassCard className="p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="grid h-11 w-11 place-items-center rounded-2xl text-white text-xl"
            style={{
              background:
                "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
            }}
          >
            💰
          </span>
          <div className="min-w-0">
            <h1 className="text-[18px] font-extrabold tracking-tight truncate">
              資金調達
            </h1>
            <div className="t-cap truncate">{projectName}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="t-cap mr-1">
            {saveState === "saving"
              ? "保存中…"
              : saveState === "saved"
                ? "✓ 保存しました"
                : ""}
          </span>
          <div className="inline-flex rounded-full bg-white p-1 shadow-[0_1px_0_var(--line-soft)] text-[12px] font-semibold">
            {(
              [
                ["cap", "📊 資本政策"],
                ["registry", "📒 株主名簿"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={
                  "px-3 py-1.5 rounded-full transition " +
                  (tab === k
                    ? "bg-ink text-white"
                    : "text-mute hover:text-ink")
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {tab === "cap" ? (
        <CapTableView
          data={data}
          rc={rc}
          patchRound={patchRound}
          addRound={addRound}
          removeRound={removeRound}
          patchSh={patchSh}
          patchAlloc={patchAlloc}
          addShareholder={addShareholder}
          removeShareholder={removeShareholder}
        />
      ) : (
        <RegistryView
          data={data}
          rc={rc}
          patchSh={patchSh}
          addShareholder={addShareholder}
          removeShareholder={removeShareholder}
        />
      )}
    </div>
  );
}

// ── 数値入力セル ──
function NumCell({
  value,
  onChange,
  className = "",
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
}) {
  return (
    <input
      type="number"
      value={value === 0 ? "" : value}
      placeholder="0"
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className={
        "w-full bg-amber-50/60 border border-line-soft rounded px-1.5 py-1 text-[12px] text-right outline-none focus:border-[--c-accent] " +
        className
      }
    />
  );
}

// ── 資本政策 (Cap-table) ──
function CapTableView({
  data,
  rc,
  patchRound,
  addRound,
  removeRound,
  patchSh,
  patchAlloc,
  addShareholder,
  removeShareholder,
}: {
  data: CapData;
  rc: RoundCalc[];
  patchRound: (id: string, patch: Partial<CapRound>) => void;
  addRound: () => void;
  removeRound: (id: string) => void;
  patchSh: (id: string, patch: Partial<CapShareholder>) => void;
  patchAlloc: (
    shId: string,
    roundId: string,
    patch: Partial<CapAlloc>,
  ) => void;
  addShareholder: (group: CapGroup) => void;
  removeShareholder: (id: string) => void;
}) {
  if (data.rounds.length === 0) {
    return (
      <GlassCard className="p-8 text-center">
        <p className="t-cap mb-4">
          まだラウンドがありません。「設立第1期」などのラウンドを追加して始めましょう。
        </p>
        <button
          type="button"
          onClick={addRound}
          className="rounded-full bg-ink px-5 py-2 text-[12.5px] font-semibold text-white hover:opacity-90"
        >
          ＋ ラウンドを追加
        </button>
      </GlassCard>
    );
  }

  const labelCol = "sticky left-0 z-10 bg-white";

  return (
    <GlassCard className="p-0 min-w-0 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-line-soft">
        <h3 className="t-h3">📊 資本政策 (Cap-table)</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addRound}
            className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold hover:bg-mute/5"
          >
            ＋ ラウンド
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse text-[12px]">
          <tbody>
            {/* ラウンド名 */}
            <tr>
              <th className={`${labelCol} text-left p-2 font-semibold w-[180px]`}>
                項目 / ラウンド
              </th>
              {rc.map(({ round }) => (
                <th
                  key={round.id}
                  colSpan={4}
                  className="p-2 bg-emerald-50/60 border-l border-line min-w-[260px]"
                >
                  <div className="flex items-center gap-1">
                    <input
                      value={round.name}
                      onChange={(e) =>
                        patchRound(round.id, { name: e.target.value })
                      }
                      className="flex-1 bg-transparent font-bold text-[13px] text-center outline-none focus:bg-white rounded px-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeRound(round.id)}
                      title="ラウンド削除"
                      className="text-mute hover:text-error text-[11px] px-1"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="date"
                      value={round.startDate || ""}
                      onChange={(e) =>
                        patchRound(round.id, { startDate: e.target.value })
                      }
                      className="flex-1 min-w-0 bg-white border border-line-soft rounded px-1 py-0.5 text-[10.5px] outline-none focus:border-[--c-accent]"
                    />
                    <span className="text-[10px] text-mute">〜</span>
                    <input
                      type="date"
                      value={round.endDate || ""}
                      onChange={(e) =>
                        patchRound(round.id, { endDate: e.target.value })
                      }
                      className="flex-1 min-w-0 bg-white border border-line-soft rounded px-1 py-0.5 text-[10.5px] outline-none focus:border-[--c-accent]"
                    />
                  </div>
                  <input
                    value={round.means}
                    placeholder="手段・メモ (例: 第三者割当)"
                    onChange={(e) =>
                      patchRound(round.id, { means: e.target.value })
                    }
                    className="w-full bg-transparent text-[10.5px] text-center text-mute outline-none focus:bg-white rounded px-1 mt-0.5"
                  />
                </th>
              ))}
            </tr>

            {/* 入力: 発行価額・資本金 */}
            <SummaryInputRow
              label="発行価額・SO行使払込金 (円)"
              rc={rc}
              get={(c) => c.round.issueAmount}
              set={(c, v) => patchRound(c.round.id, { issueAmount: v })}
            />
            <SummaryInputRow
              label="資本金・資本準備金 (円)"
              rc={rc}
              get={(c) => c.round.capital}
              set={(c, v) => patchRound(c.round.id, { capital: v })}
            />

            {/* 計算行 */}
            <SummaryRow label="新規発行株式数 (顕在)" rc={rc} val={(c) => fmt(c.newCommon)} />
            <SummaryRow label="新規発行株式数 (潜在)" rc={rc} val={(c) => fmt(c.newPotential)} />
            <SummaryRow label="発行済株式数 (顕在)" rc={rc} val={(c) => fmt(c.issuedCommon)} strong />
            <SummaryRow label="発行済株式数 (潜在)" rc={rc} val={(c) => fmt(c.issuedPotential)} />
            <SummaryRow label="発行済株式数 (合計)" rc={rc} val={(c) => fmt(c.issuedTotal)} strong />
            <SummaryRow label="想定株価 (円)" rc={rc} val={(c) => yen(c.price)} />
            <SummaryRow label="Post時価総額 (円)" rc={rc} val={(c) => yen(c.postValue)} />
            <SummaryRow label="資金調達額 (円)" rc={rc} val={(c) => yen(c.raised)} />
            <SummaryRow label="資金調達額累計 (円)" rc={rc} val={(c) => yen(c.cumRaised)} />
            <SummaryRow label="SO比率" rc={rc} val={(c) => pct(c.soRatio)} />

            {/* 株主セクションのサブヘッダー */}
            <tr>
              <th className={`${labelCol} text-left p-2 bg-canvas-2 font-semibold`}>
                株主名
              </th>
              {rc.map(({ round }) => (
                <SubHeaderCells key={round.id} />
              ))}
            </tr>

            {/* 株主行 (グループごと) */}
            {GROUPS.map((g) => {
              const members = data.shareholders.filter(
                (s) => s.group === g.key,
              );
              return (
                <GroupRows
                  key={g.key}
                  group={g}
                  members={members}
                  rc={rc}
                  patchSh={patchSh}
                  patchAlloc={patchAlloc}
                  addShareholder={addShareholder}
                  removeShareholder={removeShareholder}
                />
              );
            })}

            {/* 合計 */}
            <tr className="bg-orange-50/70 font-bold">
              <th className={`${labelCol} text-left p-2 bg-orange-50`}>合計</th>
              {rc.map((c) => (
                <FourCells
                  key={c.round.id}
                  common={fmt(c.issuedCommon)}
                  shareCommon={pct(c.issuedCommon > 0 ? 1 : 0)}
                  potential={fmt(c.issuedPotential)}
                  shareTotal={pct(c.issuedTotal > 0 ? 1 : 0)}
                />
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="t-cap p-3 opacity-70 leading-relaxed">
        ※ 黄色のセルが入力。発行済株式数・シェア・想定株価・時価総額・SO比率は割当株数と発行価額から自動計算されます。
        想定株価＝発行価額÷新規発行(顕在)、Post時価総額＝想定株価×発行済(合計)。
      </p>
    </GlassCard>
  );
}

function SummaryInputRow({
  label,
  rc,
  get,
  set,
}: {
  label: string;
  rc: RoundCalc[];
  get: (c: RoundCalc) => number;
  set: (c: RoundCalc, v: number) => void;
}) {
  return (
    <tr className="border-t border-line-soft">
      <th className="sticky left-0 z-10 bg-white text-left p-2 font-medium text-mute">
        {label}
      </th>
      {rc.map((c) => (
        <td key={c.round.id} colSpan={4} className="p-1 border-l border-line">
          <NumCell value={get(c)} onChange={(v) => set(c, v)} />
        </td>
      ))}
    </tr>
  );
}

function SummaryRow({
  label,
  rc,
  val,
  strong,
}: {
  label: string;
  rc: RoundCalc[];
  val: (c: RoundCalc) => string;
  strong?: boolean;
}) {
  return (
    <tr className="border-t border-line-soft">
      <th
        className={
          "sticky left-0 z-10 bg-white text-left p-2 " +
          (strong ? "font-bold" : "font-medium text-mute")
        }
      >
        {label}
      </th>
      {rc.map((c) => (
        <td
          key={c.round.id}
          colSpan={4}
          className={
            "p-2 text-right border-l border-line t-mono " +
            (strong ? "font-bold" : "")
          }
        >
          {val(c)}
        </td>
      ))}
    </tr>
  );
}

function SubHeaderCells() {
  return (
    <>
      <td className="p-1 text-[10px] text-center text-mute border-l border-line bg-canvas-2">
        割当(顕在)
      </td>
      <td className="p-1 text-[10px] text-center text-mute bg-canvas-2">
        シェア(顕在)
      </td>
      <td className="p-1 text-[10px] text-center text-mute bg-canvas-2">
        割当(潜在)
      </td>
      <td className="p-1 text-[10px] text-center text-mute bg-canvas-2">
        含潜在%
      </td>
    </>
  );
}

function FourCells({
  common,
  shareCommon,
  potential,
  shareTotal,
}: {
  common: string;
  shareCommon: string;
  potential: string;
  shareTotal: string;
}) {
  return (
    <>
      <td className="p-1.5 text-right border-l border-line t-mono">{common}</td>
      <td className="p-1.5 text-right t-mono text-mute">{shareCommon}</td>
      <td className="p-1.5 text-right t-mono">{potential}</td>
      <td className="p-1.5 text-right t-mono text-mute">{shareTotal}</td>
    </>
  );
}

function GroupRows({
  group,
  members,
  rc,
  patchSh,
  patchAlloc,
  addShareholder,
  removeShareholder,
}: {
  group: { key: CapGroup; label: string };
  members: CapShareholder[];
  rc: RoundCalc[];
  patchSh: (id: string, patch: Partial<CapShareholder>) => void;
  patchAlloc: (
    shId: string,
    roundId: string,
    patch: Partial<CapAlloc>,
  ) => void;
  addShareholder: (group: CapGroup) => void;
  removeShareholder: (id: string) => void;
}) {
  // グループ小計 (各ラウンドの累積)
  const subtotal = (c: RoundCalc) => {
    let common = 0;
    let potential = 0;
    for (const m of members) {
      const h = c.hold[m.id];
      if (h) {
        common += h.common;
        potential += h.potential;
      }
    }
    return {
      common,
      potential,
      shareCommon: c.issuedCommon > 0 ? common / c.issuedCommon : 0,
      shareTotal: c.issuedTotal > 0 ? (common + potential) / c.issuedTotal : 0,
    };
  };

  return (
    <>
      {members.map((sh) => (
        <tr key={sh.id} className="border-t border-line-soft hover:bg-accent-soft/20">
          <th className="sticky left-0 z-10 bg-white text-left p-1.5">
            <div className="flex items-center gap-1">
              <input
                value={sh.name}
                onChange={(e) => patchSh(sh.id, { name: e.target.value })}
                className="flex-1 min-w-0 bg-transparent font-medium outline-none focus:bg-mute/5 rounded px-1"
              />
              <button
                type="button"
                onClick={() => removeShareholder(sh.id)}
                title="株主を削除"
                className="text-mute hover:text-error text-[11px]"
              >
                ✕
              </button>
            </div>
          </th>
          {rc.map((c) => {
            const a = sh.alloc[c.round.id] ?? { common: 0, potential: 0 };
            const h = c.hold[sh.id] ?? {
              common: 0,
              potential: 0,
              total: 0,
              shareCommon: 0,
              shareTotal: 0,
            };
            return (
              <td key={c.round.id} className="border-l border-line p-0.5">
                <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-0.5 items-center">
                  <NumCell
                    value={a.common}
                    onChange={(v) =>
                      patchAlloc(sh.id, c.round.id, { common: v })
                    }
                  />
                  <span className="text-right t-mono text-[11px] text-mute px-1">
                    {pct(h.shareCommon)}
                  </span>
                  <NumCell
                    value={a.potential}
                    onChange={(v) =>
                      patchAlloc(sh.id, c.round.id, { potential: v })
                    }
                  />
                  <span className="text-right t-mono text-[11px] text-mute px-1">
                    {pct(h.shareTotal)}
                  </span>
                </div>
              </td>
            );
          })}
        </tr>
      ))}
      {/* グループ小計 */}
      <tr className="bg-sky-50/70 font-semibold">
        <th className="sticky left-0 z-10 bg-sky-50 text-left p-1.5">
          <div className="flex items-center justify-between gap-1">
            <span>{group.label} 合計</span>
            <button
              type="button"
              onClick={() => addShareholder(group.key)}
              title="この区分に株主を追加"
              className="text-[--c-accent-deep] text-[11px] font-bold whitespace-nowrap"
            >
              ＋追加
            </button>
          </div>
        </th>
        {rc.map((c) => {
          const st = subtotal(c);
          return (
            <FourCells
              key={c.round.id}
              common={fmt(st.common)}
              shareCommon={pct(st.shareCommon)}
              potential={fmt(st.potential)}
              shareTotal={pct(st.shareTotal)}
            />
          );
        })}
      </tr>
    </>
  );
}

// ── 株主名簿 (Registry) ──
function RegistryView({
  data,
  rc,
  patchSh,
  addShareholder,
  removeShareholder,
}: {
  data: CapData;
  rc: RoundCalc[];
  patchSh: (id: string, patch: Partial<CapShareholder>) => void;
  addShareholder: (group: CapGroup) => void;
  removeShareholder: (id: string) => void;
}) {
  const last = rc.length > 0 ? rc[rc.length - 1] : null;

  return (
    <GlassCard className="p-0 min-w-0 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-line-soft">
        <h3 className="t-h3">📒 株主名簿</h3>
        <button
          type="button"
          onClick={() => addShareholder("stable")}
          className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold hover:bg-mute/5"
        >
          ＋ 株主を追加
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-canvas-2 text-left">
              <th className="p-2 font-semibold">氏名 / 名称</th>
              <th className="p-2 font-semibold">区分</th>
              <th className="p-2 font-semibold">種別</th>
              <th className="p-2 font-semibold text-right">保有株数(顕在)</th>
              <th className="p-2 font-semibold text-right">保有株数(合計)</th>
              <th className="p-2 font-semibold text-right">シェア(含潜在)</th>
              <th className="p-2 font-semibold">メモ</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.shareholders.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center t-cap">
                  株主が登録されていません。「＋ 株主を追加」から登録してください。
                </td>
              </tr>
            )}
            {data.shareholders.map((sh) => {
              const h = last?.hold[sh.id];
              return (
                <tr
                  key={sh.id}
                  className="border-t border-line-soft hover:bg-accent-soft/20"
                >
                  <td className="p-1.5">
                    <input
                      value={sh.name}
                      onChange={(e) => patchSh(sh.id, { name: e.target.value })}
                      className="w-full min-w-[120px] bg-transparent font-medium outline-none focus:bg-mute/5 rounded px-1.5 py-1"
                    />
                  </td>
                  <td className="p-1.5">
                    <select
                      value={sh.group}
                      onChange={(e) =>
                        patchSh(sh.id, { group: e.target.value as CapGroup })
                      }
                      className="bg-white border border-line-soft rounded px-1.5 py-1 text-[12px] outline-none focus:border-[--c-accent]"
                    >
                      {GROUPS.map((g) => (
                        <option key={g.key} value={g.key}>
                          {GROUP_LABEL[g.key]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1.5">
                    <input
                      value={sh.kind}
                      placeholder="個人 / 法人 / VC"
                      onChange={(e) => patchSh(sh.id, { kind: e.target.value })}
                      className="w-[110px] bg-transparent outline-none focus:bg-mute/5 rounded px-1.5 py-1"
                    />
                  </td>
                  <td className="p-1.5 text-right t-mono">
                    {fmt(h?.common ?? 0)}
                  </td>
                  <td className="p-1.5 text-right t-mono">
                    {fmt(h?.total ?? 0)}
                  </td>
                  <td className="p-1.5 text-right t-mono text-mute">
                    {pct(h?.shareTotal ?? 0)}
                  </td>
                  <td className="p-1.5">
                    <input
                      value={sh.note}
                      placeholder="—"
                      onChange={(e) => patchSh(sh.id, { note: e.target.value })}
                      className="w-full min-w-[140px] bg-transparent outline-none focus:bg-mute/5 rounded px-1.5 py-1"
                    />
                  </td>
                  <td className="p-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeShareholder(sh.id)}
                      title="削除"
                      className="text-mute hover:text-error"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="t-cap p-3 opacity-70 leading-relaxed">
        ※ 保有株数・シェアは「資本政策」の最新ラウンド時点の累積値です。割当の編集は「資本政策」タブで行います。
      </p>
    </GlassCard>
  );
}
