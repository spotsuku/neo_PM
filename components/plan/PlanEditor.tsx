"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { RingV2 } from "@/components/ui/RingV2";
import { StatusDot } from "@/components/ui/StatusDot";
import { BudgetPlanGrid } from "@/components/themes/BudgetPlanGrid";
import { ProjectHistoryPanel } from "@/components/dashboard/ProjectHistoryPanel";
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
  | "qualitative_goal"
  | "schedule"
  | "budget_plan"
  | "idea_summary";

const W_CARDS: {
  key: PlanField;
  label: string;
  emo: string;
  frame: string;
  placeholder: string;
  help: HelpContent;
}[] = [
  {
    key: "why",
    label: "Why",
    emo: "💡",
    frame: "なぜ・誰のために",
    placeholder:
      "課題の背景と、なぜ「今」あなたたちが取り組むのか。社会的意義 / 自分ごと化のストーリー。",
    help: {
      title: "💡 Why — なぜ取り組むのか",
      what: "現状の課題・社会的意義・「自分ごと化」のストーリー。誰かが救われる未来像。",
      example:
        "「地域の高齢者が孤独を抱えている。私たちのチームには介護家族がいて、人の温かさを失わない介護を一緒に作りたい。」",
      ng: "・サービス説明 / 商品紹介になっている\n・「みんなのため」など曖昧な対象",
    },
  },
  {
    key: "who",
    label: "Who",
    emo: "🧑‍🤝‍🧑",
    frame: "誰の・どんな状況",
    placeholder:
      "受益者・関係者を具体的に。年齢、属性、置かれている状況、声。",
    help: {
      title: "🧑‍🤝‍🧑 Who — 誰に届けるか",
      what: "受益者・関係者の具体的な姿。年齢・属性・状況・実際の声。1 名のペルソナでも OK。",
      example:
        "「福岡市の介護施設に通う 70 代後半、要介護 1〜2、認知症の初期段階の利用者と、現場スタッフ 8 名、家族 (40〜60 代)。」",
      ng: "・「若者」「市民」など主語が大きすぎる\n・属性だけで状況が見えない",
    },
  },
  {
    key: "what",
    label: "What",
    emo: "💎",
    frame: "提供価値 (顧客が得る変化)",
    placeholder:
      "顧客にどんな価値・体験・変化を届けるか。プロダクト名やサービス内容ではなく『相手にとって何が良くなるか』を一段細かく。",
    help: {
      title: "💎 What — 相手が得る変化",
      what: "プロダクト名でなく、「顧客にとって何が良くなるか」「どんな気持ち / 行動が変わるか」。",
      example:
        "「孤独を感じていた利用者が毎日の楽しみを持てる。スタッフは事務作業から解放されケアに時間を割ける。家族は離れて暮らしていても安心できる。」",
      ng: "・「ロボットを提供する」など How に近い記述\n・機能の説明だけ",
    },
  },
  {
    key: "how",
    label: "How",
    emo: "🛠",
    frame: "実現方法 (プロダクト / サービス / 仕組み)",
    placeholder:
      "提供価値を実現する具体的な手段。プロダクト・サービス・体験設計・実施方法・スケジュール・必要なリソースなど。",
    help: {
      title: "🛠 How — どう実現するか",
      what: "What を届ける具体的な手段・段取り・スケジュール・必要リソース。",
      example:
        "「パートナー型ロボット Humo を 8 週間運用 → スタッフ研修 → 月 2 回現場入り → 定量効果 (会話量 / ケア時間 / 家族満足度) を計測。」",
      ng: "・「がんばる」「工夫する」など抽象論\n・段取りや誰がやるかが見えない",
    },
  },
];

const FOURP: {
  key: PlanField;
  emo: string;
  name: string;
  desc: string;
  help: HelpContent;
}[] = [
  {
    key: "product",
    emo: "🎁",
    name: "Product",
    desc: "コアの提供物・体験",
    help: {
      title: "🎁 Product — 提供物そのもの",
      what: "顧客が実際に手に取る・体験するもの。モノ・コト・体験パッケージ全部含む。",
      example: "「Humo ロボット 1 台 + 月 1 回の家族交流オンラインイベント」",
      ng: "・「サービス」とだけ書く\n・抽象的すぎてイメージできない",
    },
  },
  {
    key: "price",
    emo: "🏷",
    name: "Price",
    desc: "対価設計（無料 / 体験提供 / 協賛）",
    help: {
      title: "🏷 Price — 誰が何を払うか",
      what: "金銭だけでなく、時間・信頼・労力など。協賛 / 体験提供 / フリーミアム / 補助金 など設計。",
      example: "「施設利用料に月 3,000 円含む / 別途、協賛企業から月 50 万円 / 自治体補助 50%」",
      ng: "・「無料」だけ書いて経済性を不問にする\n・誰が払うか書いてない",
    },
  },
  {
    key: "place",
    emo: "📍",
    name: "Place",
    desc: "実施場所 / 流通チャネル",
    help: {
      title: "📍 Place — 顧客と接する場所",
      what: "物理空間 + デジタルチャネルの両面。誰がどう知り、どこで受け取るか。",
      example: "「施設の共用ラウンジ + 家族向け LINE オープンチャット + 月次レポート PDF」",
      ng: "・物理場所だけ書いて導線がない\n・「SNS」と一言だけ",
    },
  },
  {
    key: "promotion",
    emo: "📣",
    name: "Promotion",
    desc: "認知獲得・参加導線",
    help: {
      title: "📣 Promotion — 知ってもらう設計",
      what: "誰に・どんなメッセージで・どの順番で・いくらかけて伝えるか。参加への次の一歩まで。",
      example: "「ケアマネ向け説明会 (月 1) → 家族向け体験会 → 地元紙取材 → 自治体向け事例集」",
      ng: "・「SNS で発信」だけ\n・誰に向けたのか不明",
    },
  },
];

interface HelpContent {
  title: string;
  what: string;
  example: string;
  ng: string;
}

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
    schedule: plan.schedule ?? "",
    budget_plan: plan.budget_plan ?? "",
    idea_summary: plan.idea_summary ?? "",
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
      schedule: null,
      budget_plan: null,
      idea_summary: null,
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
        // 保存成功時に履歴スナップショットも取る。
        // RPC 側で 60 秒以内の連続 autosave はスキップされる。
        void supabase.rpc("snapshot_project", {
          p_project_id: current.id,
          p_source: "autosave",
        });
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

  // 親 (server component) から渡される最新の plan / kpis が更新されたら
  // ローカル state を同期。values は編集中の入力を上書きしないよう、
  // plan.id が変わったとき (= 別プロジェクトに切替) のみ全体を入れ替える。
  const lastPlanIdRef = useRef<string | null>(plan.id);
  useEffect(() => {
    if (lastPlanIdRef.current !== plan.id) {
      setValues({
        why: plan.why,
        who: plan.who,
        what: plan.what,
        how: plan.how,
        product: plan.product,
        price: plan.price,
        place: plan.place,
        promotion: plan.promotion,
        qualitative_goal: plan.qualitative_goal,
        schedule: plan.schedule ?? "",
        budget_plan: plan.budget_plan ?? "",
        idea_summary: plan.idea_summary ?? "",
      });
      lastPlanIdRef.current = plan.id;
    }
    // scores は AI 再評価で更新されるので毎回同期
    setScores((plan.scores ?? {}) as Record<string, number>);
  }, [plan]);
  useEffect(() => {
    setKpis(initialKpis);
  }, [initialKpis]);
  const cardScore = (k: PlanField): number | null => {
    const v = scores[k];
    return typeof v === "number" ? v : null;
  };

  // 任意の保存中かどうか
  const anySaving = savingFields.size > 0;

  // ✨ AI 下書き
  const [drafting, setDrafting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const draftWithAI = async (overwrite = false) => {
    if (drafting) return;
    setDrafting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/ai/draft-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: current.id, overwrite }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        fields?: Record<"why" | "who" | "what" | "how", string>;
        note?: string;
        overwriteRequired?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? `エラー (${res.status})`);
      if (!data.fields) throw new Error("AI 応答が空でした");

      // 上書き不可なのに全部埋まってる場合: 確認ダイアログ
      if (data.overwriteRequired) {
        const ok = window.confirm(
          "Why/Who/What/How がすべて記入済みです。AI 下書きで上書きしますか？\n（現在の内容は失われます）",
        );
        if (!ok) return;
        await draftWithAI(true);
        return;
      }

      const filled: Record<string, string> = data.fields;
      // 空でない提案だけ反映 (= 空フィールドへ書き込み)
      for (const k of ["why", "who", "what", "how"] as const) {
        const v = filled[k];
        if (v && v.trim()) updateField(k, v);
      }
      if (data.note) setErrorMsg(`✦ ${data.note}`);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "下書きに失敗しました");
    } finally {
      setDrafting(false);
    }
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
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex items-center gap-1 rounded-full bg-white border border-line px-3 py-1.5 text-[11px] font-semibold text-mute hover:text-ink transition"
            title="編集履歴を見る / この時点に戻す"
          >
            🕒 履歴
          </button>
          <button
            type="button"
            onClick={() => draftWithAI(false)}
            disabled={drafting}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-[11.5px] font-bold text-white hover:opacity-90 disabled:opacity-50 transition"
            title="AI に Why / Who / What / How を下書きしてもらう (空のフィールドだけ埋めます)"
          >
            {drafting ? (
              <>
                <span className="animate-pulse">✦</span>
                下書き中…
              </>
            ) : (
              <>
                <span aria-hidden>✦</span>
                AI に下書きしてもらう
              </>
            )}
          </button>
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
        </div>
      </GlassCard>

      <ProjectHistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        projectId={current.id}
        canRestore={true}
      />

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
              help={card.help}
            />
          ))}
          <PlanObservationCard
            projectId={current.id}
            anyEmpty={anyEmpty(values)}
            valuesKey={Object.values(values)
              .map((v) => v.trim())
              .join("")}
            initialObservation={plan.last_observation ?? null}
            initialObservedAt={plan.last_observed_at ?? null}
            initialValuesKey={plan.last_observation_values_key ?? null}
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
                  help={p.help}
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

          {/* 🧪 実証計画 + 💴 収支計画 (応募時の構造化フィールドの続き) */}
          <GlassCard className="p-5">
            <h3 className="t-h3 mb-3">
              <span aria-hidden className="mr-2">
                🧪
              </span>
              実証計画
            </h3>
            <p className="t-cap mb-2 leading-relaxed">
              事業をテストするための実証 (PoC) を「いつ・どこで・何を・誰と」で。応募時の内容が反映されています。
            </p>
            <textarea
              rows={5}
              value={values.schedule}
              onChange={(e) => updateField("schedule", e.target.value)}
              placeholder="[いつ] / [どこで] / [何を] / [誰と]"
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[--c-accent] resize-y leading-relaxed"
            />
            {savingFields.has("schedule") && (
              <span className="t-cap">保存中…</span>
            )}
          </GlassCard>

          <GlassCard className="p-5">
            <h3 className="t-h3 mb-3">
              <span aria-hidden className="mr-2">
                💴
              </span>
              収支計画
            </h3>
            <p className="t-cap mb-2 leading-relaxed">
              事業全体の月次 (半年以上) の収支計画。応募時の内容が反映されています。月末残・累計は自動計算 (単位: 万円)。
            </p>
            <BudgetPlanGrid
              value={values.budget_plan}
              onChange={(v) => updateField("budget_plan", v)}
            />
            {savingFields.has("budget_plan") && (
              <span className="t-cap">保存中…</span>
            )}
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
  initialObservation,
  initialObservedAt,
  initialValuesKey,
  onScores,
}: {
  projectId: string;
  anyEmpty: boolean;
  valuesKey: string;
  /** DB に保存された前回の観察コメント (なければ null) */
  initialObservation: string | null;
  initialObservedAt: string | null;
  /** 前回観察時の values_key (今と違えば stale) */
  initialValuesKey: string | null;
  onScores: (scores: Record<string, number>) => void;
}) {
  // DB 保存済みの観察コメントを初期値として表示
  const [observation, setObservation] = useState<string | null>(
    initialObservation && initialObservation.trim() ? initialObservation : null,
  );
  const [observedAt, setObservedAt] = useState<string | null>(initialObservedAt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // stale 判定: 保存時の values_key と現在の values_key が違うと「古い」
  // 初期 stale: DB に保存された key と現在の key が違えば true
  const initialKeyRef = useRef(initialValuesKey ?? valuesKey);
  const [stale, setStale] = useState(
    Boolean(observation) &&
      initialValuesKey !== null &&
      initialValuesKey !== valuesKey,
  );
  useEffect(() => {
    if (observation && valuesKey !== initialKeyRef.current) {
      setStale(true);
    } else if (observation && valuesKey === initialKeyRef.current) {
      setStale(false);
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
        valuesKey?: string;
        observedAt?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `エラー (${res.status})`);
      }
      setObservation(data.observation ?? "（応答が空でした）");
      setObservedAt(data.observedAt ?? new Date().toISOString());
      if (data.scores) onScores(data.scores);
      initialKeyRef.current = data.valuesKey ?? valuesKey;
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
        <div>
          <p className="text-[12.5px] leading-relaxed opacity-90 whitespace-pre-wrap">
            {observation}
          </p>
          <p className="mt-2 text-[10.5px] opacity-60">
            {observedAt
              ? `📌 評価日時: ${new Date(observedAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
              : ""}
            {stale && (
              <span className="ml-2">
                ※ 評価以降に計画が更新されています。↻ で再評価できます。
              </span>
            )}
          </p>
        </div>
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
  help: HelpContent;
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
  help,
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
          <HelpHint content={help} />
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
  help: HelpContent;
}

function FourPTile({
  emo,
  name,
  desc,
  value,
  saving,
  onChange,
  help,
}: FourPTileProps) {
  return (
    <div className="rounded-xl bg-white border border-line-soft p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span aria-hidden>{emo}</span>
        <span className="text-[12px] font-bold">{name}</span>
        <HelpHint content={help} />
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

/** ? アイコン + クリックでポップオーバーが開く解説。
 *  - createPortal で body に描画 → GlassCard の overflow / backdrop-filter に影響されない
 *  - viewport をはみ出さないよう、ボタンの位置から flip + clamp
 *  - Esc / 外側クリック / 再クリックで閉じる */
function HelpHint({ content }: { content: HelpContent }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // 開いた時 + scroll/resize 時にボタン基準で位置を計算 (右/下はみ出しを避ける)
  useEffect(() => {
    if (!open) return;
    const compute = () => {
      const btn = btnRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const popW = 280;
      const popH = popRef.current?.offsetHeight ?? 280;
      const margin = 8;
      // 水平: 右に出して画面右端を超えそうなら、ボタン右端基準で左寄せ
      let left = r.left;
      if (left + popW > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - popW - margin);
      }
      left = Math.max(margin, left);
      // 垂直: 下に出して画面下端を超えそうなら、ボタンの上に出す
      let top = r.bottom + 6;
      if (top + popH > window.innerHeight - margin) {
        top = Math.max(margin, r.top - popH - 6);
      }
      setPos({ top, left });
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="この項目の書き方を見る"
        aria-expanded={open}
        className={
          "grid h-[18px] w-[18px] place-items-center rounded-full text-[10px] font-bold leading-none transition " +
          (open
            ? "bg-ink text-white"
            : "bg-mute/10 text-mute hover:bg-[--c-accent] hover:text-white")
        }
      >
        ?
      </button>
      {open && mounted && pos && createPortal(
        <div
          ref={popRef}
          role="tooltip"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: "min(280px, calc(100vw - 16px))",
          }}
          className="z-[200] rounded-xl border border-line bg-white p-3 text-left shadow-[0_18px_50px_-18px_rgba(20,30,80,.35)]"
        >
          <div className="text-[12px] font-extrabold text-ink mb-1.5 leading-tight">
            {content.title}
          </div>
          <div className="mb-2">
            <div className="t-label mb-0.5">📝 書くこと</div>
            <p className="text-[11.5px] leading-relaxed text-ink-2">
              {content.what}
            </p>
          </div>
          <div className="mb-2 rounded-md bg-accent-soft/40 px-2 py-1.5">
            <div className="t-label mb-0.5">✨ 例</div>
            <p className="text-[11.5px] leading-relaxed text-ink-2 whitespace-pre-wrap">
              {content.example}
            </p>
          </div>
          <div>
            <div className="t-label mb-0.5 text-error">⚠️ NG パターン</div>
            <p className="text-[11.5px] leading-relaxed text-ink-2 whitespace-pre-wrap">
              {content.ng}
            </p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
