"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusDot } from "@/components/ui/StatusDot";
import type { Database } from "@/lib/types/database";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type App = Database["public"]["Tables"]["fund_applications"]["Row"];
type ProjectStub = {
  id: string;
  name: string;
  team_name: string | null;
  status: string;
};

const yen = (n: number) => `¥${(n ?? 0).toLocaleString("ja-JP")}`;

const STATUS_PIPELINE: {
  key: App["status"];
  label: string;
  emo: string;
}[] = [
  { key: "draft", label: "下書き", emo: "✏️" },
  { key: "firstReview", label: "一次審査", emo: "🔎" },
  { key: "secondReview", label: "二次審査", emo: "🧐" },
  { key: "approved", label: "承認・送金", emo: "💴" },
];

type PurposeRow = { item: string; amount: number; ratio?: number };

interface Props {
  orgSlug: string;
  projects: ProjectStub[];
  current: Project;
  initialApps: App[];
  activeId: string | null;
}

export function FundBoard({
  orgSlug,
  projects,
  current,
  initialApps,
  activeId,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [apps, setApps] = useState<App[]>(initialApps);
  const [selectedId, setSelectedId] = useState<string | null>(
    activeId ?? initialApps[0]?.id ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  const selected = apps.find((a) => a.id === selectedId) ?? null;

  // デバウンス保存
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const patchApp = (id: string, patch: Partial<App>) => {
    setApps((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );
    const t = timersRef.current.get(id);
    if (t) clearTimeout(t);
    const next = setTimeout(async () => {
      const { error: err } = await supabase
        .from("fund_applications")
        .update(patch as never)
        .eq("id", id);
      if (err) setError(err.message);
    }, 600);
    timersRef.current.set(id, next);
  };
  useEffect(() => () => timersRef.current.forEach((t) => clearTimeout(t)), []);

  const createApp = async () => {
    const round = apps.length + 1;
    const { data, error: err } = await supabase
      .from("fund_applications")
      .insert({
        project_id: current.id,
        round,
        status: "draft",
        amount_jpy: 0,
        reason: "",
      })
      .select()
      .single();
    if (err || !data) {
      setError(err?.message ?? "作成に失敗しました");
      return;
    }
    setApps((prev) => [data, ...prev]);
    setSelectedId(data.id);
    router.replace(`/${orgSlug}/fund?id=${data.id}`, { scroll: false });
  };

  const removeApp = async (id: string) => {
    if (!confirm("この申請を削除しますか？")) return;
    setApps((prev) => prev.filter((a) => a.id !== id));
    if (selectedId === id) setSelectedId(null);
    await supabase.from("fund_applications").delete().eq("id", id);
  };

  const selectApp = (id: string) => {
    setSelectedId(id);
    router.replace(`/${orgSlug}/fund?id=${id}`, { scroll: false });
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
            📨
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-[18px] font-extrabold tracking-tight truncate">
                {current.name} の NEO基金申請
              </h1>
              <StatusDot status={current.status} />
            </div>
            <div className="t-cap truncate">
              申請ステータス追跡・用途内訳・AI 添削
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={createApp}
            className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white hover:opacity-90"
          >
            ＋ 新規申請
          </button>
        </div>
      </GlassCard>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!selected ? (
        <GlassCard className="p-10 text-center">
          <div className="text-4xl mb-3">📋</div>
          <h3 className="t-h3 mb-1">申請がまだありません</h3>
          <p className="t-cap mb-5">
            「＋ 新規申請」から第1回の申請を作成してください。
          </p>
        </GlassCard>
      ) : (
        <>
          {/* ステータスパイプライン */}
          <GlassCard className="p-5">
            <StatusPipeline
              currentStatus={selected.status}
              onChange={(s) => patchApp(selected.id, { status: s })}
            />
            <div className="mt-3 t-cap text-center">
              第 {selected.round} 回申請 ・ 作成日{" "}
              {new Date(selected.created_at).toLocaleDateString("ja-JP")}
            </div>
          </GlassCard>

          {/* 左: 申請内容 / 右: AI添削 + 履歴 */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 lg:gap-5">
            <div className="flex flex-col gap-4">
              <FundEditor app={selected} onPatch={patchApp} />
              <PurposesEditor app={selected} onPatch={patchApp} />
            </div>

            <div className="flex flex-col gap-4">
              <AIHints app={selected} />

              <GlassCard className="p-5">
                <h3 className="t-h3 mb-3">
                  <span aria-hidden className="mr-2">
                    📜
                  </span>
                  過去申請履歴
                </h3>
                {apps.length === 0 ? (
                  <p className="t-cap">まだ履歴がありません</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {apps.map((a) => (
                      <li
                        key={a.id}
                        className={
                          "grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center rounded-lg px-2 py-1.5 cursor-pointer " +
                          (a.id === selectedId
                            ? "bg-accent-soft text-[--c-accent-deep]"
                            : "hover:bg-mute/5")
                        }
                        onClick={() => selectApp(a.id)}
                      >
                        <span className="t-mono text-[10px]">#{a.round}</span>
                        <span className="text-[12px] font-semibold truncate">
                          {yen(a.amount_jpy)}
                        </span>
                        <span className="t-cap">
                          {new Date(a.created_at)
                            .toLocaleDateString("ja-JP")
                            .slice(5)}
                        </span>
                        <StatusChip status={a.status} />
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => removeApp(selected.id)}
                  className="mt-3 w-full rounded-md bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-error hover:bg-red-100"
                >
                  🗑 この申請を削除
                </button>
              </GlassCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatusPipeline({
  currentStatus,
  onChange,
}: {
  currentStatus: App["status"];
  onChange: (s: App["status"]) => void;
}) {
  const isApproved = currentStatus === "approved";
  const isRejected = currentStatus === "rejected";
  const stepIdx = STATUS_PIPELINE.findIndex((s) => s.key === currentStatus);

  return (
    <div className="flex items-center gap-1">
      {STATUS_PIPELINE.map((s, i) => {
        const completed = i < stepIdx || isApproved;
        const isCurrent = i === stepIdx;
        return (
          <div key={s.key} className="flex-1 flex items-center gap-1">
            <button
              type="button"
              onClick={() => onChange(s.key)}
              className="flex flex-col items-center gap-1 group flex-1"
            >
              <div
                className={
                  "relative grid h-12 w-12 place-items-center rounded-full transition " +
                  (isCurrent ? "ring-[5px]" : "")
                }
                style={{
                  background: completed
                    ? "var(--ink)"
                    : isCurrent
                      ? "var(--c-accent)"
                      : "var(--canvas)",
                  color: completed || isCurrent ? "#fff" : "var(--mute)",
                  border: !completed && !isCurrent
                    ? "2px solid var(--line)"
                    : "none",
                  // @ts-expect-error custom CSS var
                  "--tw-ring-color": "var(--c-accent-soft)",
                }}
              >
                <span className="text-[15px]">{s.emo}</span>
              </div>
              <span
                className={
                  "t-cap " +
                  (isCurrent ? "font-bold text-ink" : "")
                }
              >
                {s.label}
              </span>
            </button>
            {i < STATUS_PIPELINE.length - 1 && (
              <div
                className="h-[2px] flex-1"
                style={{
                  background:
                    i < stepIdx || isApproved
                      ? "var(--ink)"
                      : "var(--line)",
                }}
              />
            )}
          </div>
        );
      })}
      {isRejected && (
        <button
          type="button"
          onClick={() => onChange("draft")}
          className="ml-2 rounded-full bg-error px-3 py-1 text-[10px] font-semibold text-white"
        >
          ✕ 不採択 (再申請)
        </button>
      )}
    </div>
  );
}

function FundEditor({
  app,
  onPatch,
}: {
  app: App;
  onPatch: (id: string, patch: Partial<App>) => void;
}) {
  const [amount, setAmount] = useState(app.amount_jpy);
  const [reason, setReason] = useState(app.reason ?? "");
  useEffect(() => {
    setAmount(app.amount_jpy);
    setReason(app.reason ?? "");
  }, [app.id, app.amount_jpy, app.reason]);

  return (
    <GlassCard className="p-5">
      <h3 className="t-h3 mb-3">
        <span aria-hidden className="mr-2">
          📝
        </span>
        申請内容
      </h3>

      <label className="block mb-4">
        <span className="t-label block mb-1">申請額</span>
        <div className="flex items-baseline gap-2">
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) =>
              setAmount(parseInt(e.target.value || "0", 10))
            }
            onBlur={() => onPatch(app.id, { amount_jpy: amount })}
            className="t-big rounded-lg border border-line bg-white px-4 py-2 outline-none focus:border-[--c-accent]"
            style={{ fontSize: 22, width: 200 }}
          />
          <span className="t-cap">円</span>
          {app.round > 1 && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-[--c-accent-deep]">
              中間報告 加算分
            </span>
          )}
        </div>
      </label>

      <label className="block">
        <span className="t-label block mb-1">申請理由</span>
        <textarea
          rows={6}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => onPatch(app.id, { reason })}
          placeholder="プロジェクトの背景、なぜこの基金が必要か、得られる成果を具体的に。"
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-[--c-accent] resize-none"
        />
      </label>

      <div className="mt-3">
        <span className="t-label block mb-1">添付ファイル</span>
        <div className="flex flex-wrap gap-1.5">
          {(app.attachments ?? []).map((a) => (
            <span
              key={a}
              className="rounded-full bg-white border border-line px-2.5 py-1 text-[10.5px]"
            >
              📎 {a}
            </span>
          ))}
          <button
            type="button"
            onClick={() => {
              const name = prompt("添付ファイル名（例: 見積書.pdf）");
              if (!name) return;
              const next = [...(app.attachments ?? []), name];
              onPatch(app.id, { attachments: next });
            }}
            className="rounded-full border border-dashed border-line px-3 py-1 text-[10.5px] text-mute hover:text-ink hover:bg-mute/5"
          >
            ＋ 追加
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

function PurposesEditor({
  app,
  onPatch,
}: {
  app: App;
  onPatch: (id: string, patch: Partial<App>) => void;
}) {
  const rows = (app.purposes as unknown as PurposeRow[] | null) ?? [];
  const total = rows.reduce((s, r) => s + (r.amount ?? 0), 0);

  const update = (next: PurposeRow[]) =>
    onPatch(app.id, { purposes: next as unknown as never });

  const addRow = () =>
    update([...rows, { item: "新しい用途", amount: 0 }]);

  const updateRow = (i: number, patch: Partial<PurposeRow>) =>
    update(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const removeRow = (i: number) =>
    update(rows.filter((_, idx) => idx !== i));

  return (
    <GlassCard className="p-5">
      <div className="flex items-end justify-between mb-3">
        <h3 className="t-h3">
          <span aria-hidden className="mr-2">
            🧮
          </span>
          用途内訳
        </h3>
        <button
          type="button"
          onClick={addRow}
          className="rounded-full bg-ink px-3 py-1 text-[11px] font-semibold text-white hover:opacity-90"
        >
          ＋ 用途を追加
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="t-cap text-center py-4">
          内訳をまだ入れていません
        </p>
      ) : (
        <div className="rounded-lg overflow-hidden border border-line-soft">
          <div className="grid grid-cols-[1fr_140px_100px_28px] gap-2 px-3 py-1.5 bg-canvas-2 t-label">
            <span>項目</span>
            <span>比率</span>
            <span className="text-right">金額</span>
            <span />
          </div>
          {rows.map((r, i) => {
            const ratio = total > 0 ? (r.amount / total) * 100 : 0;
            return (
              <div
                key={i}
                className="grid grid-cols-[1fr_140px_100px_28px] gap-2 px-3 py-2 items-center border-t border-line-soft"
              >
                <input
                  type="text"
                  value={r.item}
                  onChange={(e) => updateRow(i, { item: e.target.value })}
                  className="rounded bg-transparent px-1 py-0.5 text-[12.5px] outline-none hover:bg-white focus:bg-white"
                />
                <div className="h-2 rounded-full bg-line-soft overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${ratio}%`,
                      background:
                        "linear-gradient(90deg, var(--c-accent), var(--c-accent-deep))",
                    }}
                  />
                </div>
                <input
                  type="number"
                  min={0}
                  value={r.amount}
                  onChange={(e) =>
                    updateRow(i, {
                      amount: parseInt(e.target.value || "0", 10),
                    })
                  }
                  className="text-right t-mono rounded bg-transparent px-1 py-0.5 text-[12px] outline-none hover:bg-white focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="grid h-5 w-5 place-items-center text-mute hover:text-error hover:bg-red-50 rounded"
                >
                  ✕
                </button>
              </div>
            );
          })}
          {/* 合計 */}
          <div className="grid grid-cols-[1fr_140px_100px_28px] gap-2 px-3 py-2 items-center border-t-2 border-ink/30 bg-canvas-2">
            <span className="text-[12.5px] font-bold">合計</span>
            <span />
            <span className="text-right t-mono text-[12.5px] font-bold">
              {yen(total)}
            </span>
            <span />
          </div>
        </div>
      )}
      {total > app.amount_jpy && app.amount_jpy > 0 && (
        <p className="t-cap mt-2 text-error">
          ⚠️ 用途内訳の合計が申請額を超えています
        </p>
      )}
    </GlassCard>
  );
}

function StatusChip({ status }: { status: App["status"] }) {
  const map: Record<string, { label: string; bg: string }> = {
    draft: { label: "下書き", bg: "var(--mute)" },
    firstReview: { label: "一次", bg: "var(--c-accent)" },
    secondReview: { label: "二次", bg: "var(--warn)" },
    approved: { label: "承認", bg: "var(--ok)" },
    rejected: { label: "不採択", bg: "var(--error)" },
  };
  const m = map[status] ?? map.draft;
  return (
    <span
      className="rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white"
      style={{ background: m.bg }}
    >
      {m.label}
    </span>
  );
}

function AIHints({ app }: { app: App }) {
  // 簡易ルールベース（後で Anthropic 連携で書き換え）
  const reason = (app.reason ?? "").trim();
  const purposes = (app.purposes as unknown as PurposeRow[] | null) ?? [];
  const total = purposes.reduce((s, r) => s + r.amount, 0);

  const hints: { n: number; title: string; detail: string; kind: "warn" | "ok" }[] = [];
  if (reason.length < 120) {
    hints.push({
      n: 1,
      title: "申請理由が短すぎます",
      detail:
        "なぜ今このタイミングで必要なのか、地域への波及効果を 300 字以上で具体化しましょう。",
      kind: "warn",
    });
  } else {
    hints.push({
      n: 1,
      title: "理由の量はOK",
      detail: "具体性が伝わる文章量です。",
      kind: "ok",
    });
  }
  if (purposes.length === 0) {
    hints.push({
      n: 2,
      title: "用途内訳が未入力",
      detail: "最低でも 3 項目に分けて、項目ごとの目的と効果を明示しましょう。",
      kind: "warn",
    });
  } else if (total !== app.amount_jpy && app.amount_jpy > 0) {
    hints.push({
      n: 2,
      title: "申請額と内訳が一致していません",
      detail: `用途内訳合計 ${yen(total)} と申請額 ${yen(app.amount_jpy)} に差があります。`,
      kind: "warn",
    });
  } else {
    hints.push({
      n: 2,
      title: "用途内訳の整合性OK",
      detail: "申請額と一致しています。",
      kind: "ok",
    });
  }
  hints.push({
    n: 3,
    title: "中間報告の準備",
    detail: "承認後 4 週で中間報告が求められます。WBS にマイルストーン化しましょう。",
    kind: "warn",
  });

  return (
    <GlassCard variant="dark" className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <span
          className="grid h-7 w-7 place-items-center rounded-full text-white text-[13px]"
          style={{
            background:
              "conic-gradient(from 220deg, var(--c-accent), var(--c-accent-deep) 60%, #0a0a0a)",
          }}
        >
          ✦
        </span>
        <div className="text-[13px] font-bold">NEO.ai の添削</div>
      </div>
      <ul className="flex flex-col gap-2.5">
        {hints.map((h) => (
          <li key={h.n} className="flex items-start gap-2.5">
            <span
              className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold flex-shrink-0"
              style={{
                background:
                  h.kind === "ok" ? "var(--ok)" : "var(--warn)",
                color: "#fff",
              }}
            >
              {h.n}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-semibold mb-0.5">
                {h.title}
              </div>
              <div className="text-[11px] opacity-80 leading-relaxed">
                {h.detail}
              </div>
            </div>
            <span className="opacity-60 text-[14px]">›</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled
        className="mt-4 w-full rounded-md bg-white/10 px-3 py-2 text-[11.5px] font-semibold opacity-70 cursor-not-allowed"
      >
        ✦ 改善案をまとめて適用（近日）
      </button>
    </GlassCard>
  );
}
