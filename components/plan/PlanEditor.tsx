"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { RingV2 } from "@/components/ui/RingV2";
import { StatusDot } from "@/components/ui/StatusDot";
import { ProjectPicker } from "@/components/projects/ProjectPicker";
import type { Database } from "@/lib/types/database";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Plan = Database["public"]["Tables"]["execution_plans"]["Row"];
type Kpi = Database["public"]["Tables"]["kpis"]["Row"];

interface Props {
  orgSlug: string;
  projects: { id: string; name: string; team_name: string | null; status: string }[];
  current: Project;
  plan: Plan;
  kpis: Kpi[];
}

type PlanField =
  | "why"
  | "who"
  | "what"
  | "how"
  | "product"
  | "price"
  | "place"
  | "promotion"
  | "qualitative_goal";

const W_CARDS: {
  key: PlanField;
  label: string;
  emo: string;
  frame: string;
  placeholder: string;
}[] = [
  {
    key: "why",
    label: "Why",
    emo: "💡",
    frame: "なぜ・誰のために",
    placeholder:
      "課題の背景と、なぜ「今」あなたたちが取り組むのか。社会的意義 / 自分ごと化のストーリー。",
  },
  {
    key: "who",
    label: "Who",
    emo: "🧑‍🤝‍🧑",
    frame: "誰の・どんな状況",
    placeholder:
      "受益者・関係者を具体的に。年齢、属性、置かれている状況、声。",
  },
  {
    key: "what",
    label: "What",
    emo: "💎",
    frame: "提供価値 (顧客が得る変化)",
    placeholder:
      "顧客にどんな価値・体験・変化を届けるか。プロダクト名やサービス内容ではなく『相手にとって何が良くなるか』を一段細かく。",
  },
  {
    key: "how",
    label: "How",
    emo: "🛠",
    frame: "実現方法 (プロダクト / サービス / 仕組み)",
    placeholder:
      "提供価値を実現する具体的な手段。プロダクト・サービス・体験設計・実施方法・スケジュール・必要なリソースなど。",
  },
];

const FOURP: { key: PlanField; emo: string; name: string; desc: string }[] = [
  {
    key: "product",
    emo: "🎁",
    name: "Product",
    desc: "コアの提供物・体験",
  },
  {
    key: "price",
    emo: "🏷",
    name: "Price",
    desc: "対価設計（無料 / 体験提供 / 協賛）",
  },
  {
    key: "place",
    emo: "📍",
    name: "Place",
    desc: "実施場所 / 流通チャネル",
  },
  {
    key: "promotion",
    emo: "📣",
    name: "Promotion",
    desc: "認知獲得・参加導線",
  },
];

export function PlanEditor({
  orgSlug,
  projects,
  current,
  plan,
  kpis: initialKpis,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // 編集中の値（楽観的 UI）
  const [values, setValues] = useState<Record<PlanField, string>>({
    why: plan.why,
    who: plan.who,
    what: plan.what,
    how: plan.how,
    product: plan.product,
    price: plan.price,
    place: plan.place,
    promotion: plan.promotion,
    qualitative_goal: plan.qualitative_goal,
  });
  const [savingFields, setSavingFields] = useState<Set<PlanField>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // KPI ローカル状態
  const [kpis, setKpis] = useState<Kpi[]>(initialKpis);
  const [newKpi, setNewKpi] = useState({ label: "", target: "", progress: 0 });

  // デバウンス save
  const timersRef = useRef<Record<PlanField, ReturnType<typeof setTimeout> | null>>(
    {
      why: null,
      who: null,
      what: null,
      how: null,
      product: null,
      price: null,
      place: null,
      promotion: null,
      qualitative_goal: null,
    },
  );

  const updateField = (field: PlanField, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (timersRef.current[field]) {
      clearTimeout(timersRef.current[field]!);
    }
    timersRef.current[field] = setTimeout(async () => {
      setSavingFields((prev) => new Set(prev).add(field));
      const { error } = await supabase
        .from("execution_plans")
        .update({ [field]: value })
        .eq("id", plan.id);
      setSavingFields((prev) => {
        const next = new Set(prev);
        next.delete(field);
        return next;
      });
      if (error) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg(null);
      }
    }, 800);
  };

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach((t) => t && clearTimeout(t));
    };
  }, []);

  // KPI 追加
  const addKpi = async () => {
    const label = newKpi.label.trim();
    if (!label) return;
    const { data, error } = await supabase
      .from("kpis")
      .insert({
        plan_id: plan.id,
        label,
        target: newKpi.target.trim() || null,
        progress: Math.max(0, Math.min(100, newKpi.progress)),
      })
      .select()
      .single();
    if (error || !data) {
      setErrorMsg(error?.message ?? "KPI の追加に失敗しました");
      return;
    }
    setKpis((prev) => [...prev, data]);
    setNewKpi({ label: "", target: "", progress: 0 });
  };

  const updateKpi = async (id: string, patch: Partial<Kpi>) => {
    setKpis((prev) =>
      prev.map((k) => (k.id === id ? { ...k, ...patch } : k)),
    );
    const { error } = await supabase.from("kpis").update(patch).eq("id", id);
    if (error) setErrorMsg(error.message);
  };

  const removeKpi = async (id: string) => {
    setKpis((prev) => prev.filter((k) => k.id !== id));
    const { error } = await supabase.from("kpis").delete().eq("id", id);
    if (error) setErrorMsg(error.message);
  };

  // AI スコア（plan.scores が無ければ未評価扱い）
  const [scores, setScores] = useState<Record<string, number>>(
    (plan.scores ?? {}) as Record<string, number>,
  );
  const cardScore = (k: PlanField): number | null => {
    const v = scores[k];
    return typeof v === "number" ? v : null;
  };

  // 任意の保存中かどうか
  const anySaving = savingFields.size > 0;

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
            🎯
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-[18px] font-extrabold tracking-tight truncate">
                {current.name} の実行計画
              </h1>
              <StatusDot status={current.status} />
            </div>
            <div className="t-cap truncate">
              {current.team_name ?? ""} {current.idea_title ? `・ ${current.idea_title}` : ""}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={
              "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition " +
              (anySaving
                ? "bg-accent-soft text-[--c-accent-deep]"
                : "bg-white text-mute")
            }
          >
            {anySaving ? "💾 保存中..." : "✓ 自動保存"}
          </span>
          <ProjectPicker
            orgSlug={orgSlug}
            projects={projects}
            currentId={current.id}
          />
        </div>
      </GlassCard>

      {errorMsg && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Body: 左 1.2fr × 右 1fr */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4 lg:gap-5">
        {/* 左: Why/Who/What/How + AI hint */}
        <div className="flex flex-col gap-3">
          {W_CARDS.map(({ key, ...card }) => (
            <WCard
              key={key}
              {...card}
              value={values[key]}
              saving={savingFields.has(key)}
              score={cardScore(key)}
              onChange={(v) => updateField(key, v)}
            />
          ))}
          <PlanObservationCard
            projectId={current.id}
            anyEmpty={anyEmpty(values)}
            valuesKey={Object.values(values).join("|")}
            onScores={(s) =>
              setScores((prev) => ({ ...prev, ...s }) as Record<string, number>)
            }
          />
        </div>

        {/* 右: 4P + 目標 */}
        <div className="flex flex-col gap-3">
          <GlassCard className="p-5">
            <h3 className="t-h3 mb-3">
              <span aria-hidden className="mr-2">
                🧪
              </span>
              4P マーケティングミックス
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {FOURP.map(({ key, ...p }) => (
                <FourPTile
                  key={key}
                  {...p}
                  value={values[key]}
                  saving={savingFields.has(key)}
                  onChange={(v) => updateField(key, v)}
                />
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <h3 className="t-h3 mb-3">
              <span aria-hidden className="mr-2">
                🎯
              </span>
              目標
            </h3>
            <label className="block mb-4">
              <span className="t-label block mb-1">定性的なゴール</span>
              <textarea
                rows={3}
                value={values.qualitative_goal}
                onChange={(e) =>
                  updateField("qualitative_goal", e.target.value)
                }
                placeholder="例: 高校生 5 名のチームが、地域の大人と「対等な共創」を体験する。"
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[--c-accent] resize-none"
              />
              {savingFields.has("qualitative_goal") && (
                <span className="t-cap">保存中…</span>
              )}
            </label>

            <div className="mb-2 flex items-center justify-between">
              <span className="t-label">定量 KPI</span>
              <span className="t-cap">{kpis.length} 件</span>
            </div>
            <ul className="flex flex-col gap-2 mb-3">
              {kpis.map((k) => (
                <KpiRow
                  key={k.id}
                  kpi={k}
                  onUpdate={(patch) => updateKpi(k.id, patch)}
                  onRemove={() => removeKpi(k.id)}
                />
              ))}
              {kpis.length === 0 && (
                <li className="t-cap py-2 text-center">
                  KPI を 1〜3 個追加しましょう
                </li>
              )}
            </ul>

            {/* KPI 追加フォーム */}
            <div className="rounded-lg border border-dashed border-line p-3 grid grid-cols-[1fr_1fr_80px_auto] gap-2 items-center">
              <input
                type="text"
                placeholder="ラベル (例: 延べ参加)"
                value={newKpi.label}
                onChange={(e) =>
                  setNewKpi((s) => ({ ...s, label: e.target.value }))
                }
                className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent]"
              />
              <input
                type="text"
                placeholder="ターゲット (例: 200名)"
                value={newKpi.target}
                onChange={(e) =>
                  setNewKpi((s) => ({ ...s, target: e.target.value }))
                }
                className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent]"
              />
              <input
                type="number"
                placeholder="0-100"
                min={0}
                max={100}
                value={newKpi.progress}
                onChange={(e) =>
                  setNewKpi((s) => ({
                    ...s,
                    progress: parseInt(e.target.value || "0", 10),
                  }))
                }
                className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent] t-mono"
              />
              <button
                type="button"
                onClick={addKpi}
                className="rounded-md bg-ink px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90"
              >
                ＋
              </button>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function anyEmpty(values: Record<PlanField, string>): boolean {
  return (
    !values.why.trim() ||
    !values.who.trim() ||
    !values.what.trim() ||
    !values.how.trim()
  );
}

function PlanObservationCard({
  projectId,
  anyEmpty,
  valuesKey,
  onScores,
}: {
  projectId: string;
  anyEmpty: boolean;
  valuesKey: string;
  onScores: (scores: Record<string, number>) => void;
}) {
  const [observation, setObservation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  // 値が変わったら「コメントが古い」マークを付ける（自動再取得はしない）
  const initialKeyRef = useRef(valuesKey);
  useEffect(() => {
    if (observation && valuesKey !== initialKeyRef.current) {
      setStale(true);
    }
  }, [valuesKey, observation]);

  const fetchObservation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/observe-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        observation?: string;
        scores?: Record<string, number> | null;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `エラー (${res.status})`);
      }
      setObservation(data.observation ?? "（応答が空でした）");
      if (data.scores) onScores(data.scores);
      initialKeyRef.current = valuesKey;
      setStale(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "取得に失敗しました";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

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
        <div className="text-[13px] font-bold">NEO.ai のヒント</div>
        <button
          type="button"
          onClick={fetchObservation}
          disabled={loading}
          className="ml-auto rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/90 hover:bg-white/20 disabled:opacity-50"
        >
          {loading
            ? "考え中…"
            : observation
              ? stale
                ? "↻ もう一度コメントをもらう"
                : "↻ 更新"
              : "✦ AI からコメントをもらう"}
        </button>
      </div>

      {error && (
        <div className="mb-2 rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-[11.5px] leading-relaxed text-red-100">
          {error}
        </div>
      )}

      {observation ? (
        <p className="text-[12.5px] leading-relaxed opacity-90 whitespace-pre-wrap">
          {observation}
          {stale && (
            <span className="block mt-2 text-[11px] opacity-60">
              ※ 計画が更新されました。↻ で最新の観察を取得できます。
            </span>
          )}
        </p>
      ) : (
        <p className="text-[12.5px] leading-relaxed opacity-90">
          {anyEmpty
            ? "まずは Why から書いてみましょう。1行でも構いません。書き終えたら ✦ ボタンで AI が観察コメントを返します。"
            : "Why → Who → What → How を一読し、矛盾なく繋がっているかチェックしましょう。✦ ボタンで AI のコメントを取得できます。"}
        </p>
      )}
    </GlassCard>
  );
}

interface WCardProps {
  label: string;
  emo: string;
  frame: string;
  placeholder: string;
  value: string;
  saving: boolean;
  score: number | null;
  onChange: (v: string) => void;
}

function WCard({
  label,
  emo,
  frame,
  placeholder,
  value,
  saving,
  score,
  onChange,
}: WCardProps) {
  return (
    <GlassCard className="p-4 flex items-stretch gap-3">
      <div
        className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] text-white text-[15px] font-extrabold tracking-tight"
        style={{ background: "var(--ink)" }}
      >
        {label}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span aria-hidden>{emo}</span>
          <span className="t-label">{frame}</span>
          {saving && <span className="t-cap ml-auto">保存中…</span>}
        </div>
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-line-soft bg-white px-2.5 py-2 text-[12.5px] outline-none focus:border-[--c-accent] resize-none"
        />
      </div>
      <div className="grid place-items-center shrink-0">
        <RingV2
          size={48}
          stroke={5}
          value={score ?? 0}
          showValue={score !== null}
          label="AI"
        />
        {score === null && (
          <span className="t-cap mt-1">未評価</span>
        )}
      </div>
    </GlassCard>
  );
}

interface FourPTileProps {
  emo: string;
  name: string;
  desc: string;
  value: string;
  saving: boolean;
  onChange: (v: string) => void;
}

function FourPTile({ emo, name, desc, value, saving, onChange }: FourPTileProps) {
  return (
    <div className="rounded-xl bg-white border border-line-soft p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span aria-hidden>{emo}</span>
        <span className="text-[12px] font-bold">{name}</span>
        {saving && <span className="t-cap ml-auto">保存中…</span>}
      </div>
      <p className="t-cap mb-2 leading-tight">{desc}</p>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="..."
        className="w-full rounded-md border border-line-soft bg-canvas-2 px-2 py-1.5 text-[12px] outline-none focus:border-[--c-accent] resize-none"
      />
    </div>
  );
}

interface KpiRowProps {
  kpi: Kpi;
  onUpdate: (patch: Partial<Kpi>) => void;
  onRemove: () => void;
}

function KpiRow({ kpi, onUpdate, onRemove }: KpiRowProps) {
  const [local, setLocal] = useState({
    label: kpi.label,
    target: kpi.target ?? "",
    progress: kpi.progress,
  });
  const commit = () => {
    onUpdate({
      label: local.label,
      target: local.target || null,
      progress: Math.max(0, Math.min(100, local.progress)),
    });
  };
  return (
    <li className="rounded-lg bg-white border border-line-soft p-2.5">
      <div className="grid grid-cols-[1fr_1fr_70px_auto] gap-2 items-center mb-1.5">
        <input
          type="text"
          value={local.label}
          onChange={(e) => setLocal((s) => ({ ...s, label: e.target.value }))}
          onBlur={commit}
          className="rounded-md border border-line-soft bg-canvas-2 px-2 py-1 text-[12px] outline-none focus:border-[--c-accent]"
        />
        <input
          type="text"
          placeholder="ターゲット"
          value={local.target}
          onChange={(e) => setLocal((s) => ({ ...s, target: e.target.value }))}
          onBlur={commit}
          className="rounded-md border border-line-soft bg-canvas-2 px-2 py-1 text-[12px] outline-none focus:border-[--c-accent]"
        />
        <input
          type="number"
          min={0}
          max={100}
          value={local.progress}
          onChange={(e) =>
            setLocal((s) => ({
              ...s,
              progress: parseInt(e.target.value || "0", 10),
            }))
          }
          onBlur={commit}
          className="rounded-md border border-line-soft bg-canvas-2 px-2 py-1 text-[12px] outline-none focus:border-[--c-accent] t-mono"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="KPI を削除"
          className="grid h-7 w-7 place-items-center rounded-md text-mute hover:bg-red-50 hover:text-error"
        >
          ✕
        </button>
      </div>
      <div className="h-1.5 rounded-full bg-line-soft overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.max(0, Math.min(100, local.progress))}%`,
            background:
              "linear-gradient(90deg, var(--c-accent), var(--c-accent-deep))",
          }}
        />
      </div>
    </li>
  );
}
