"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { BudgetPlanGrid } from "@/components/themes/BudgetPlanGrid";
import type { Database } from "@/lib/types/database";

type Application = Database["public"]["Tables"]["theme_applications"]["Row"];
type AppStatus = Application["status"];

interface Props {
  orgSlug: string;
  themeId: string;
  applicantUserId: string;
  applicantOrgId: string;
  initial: Application | null;
  applicantJoined?: boolean;
  defaultTeamName: string;
}

const STATUS_META: Record<AppStatus, { label: string; bg: string; emo: string }> = {
  draft: { label: "下書き", bg: "var(--mute)", emo: "📝" },
  submitted: { label: "応募済み", bg: "var(--c-accent)", emo: "✉️" },
  under_review: { label: "審査中", bg: "var(--warn)", emo: "🔎" },
  approved: { label: "✓ 合格", bg: "var(--ok)", emo: "🎉" },
  rejected: { label: "✕ 不採択", bg: "var(--error)", emo: "📦" },
  withdrawn: { label: "取下げ", bg: "var(--mute)", emo: "↩" },
};

export function ApplicationForm({
  orgSlug,
  themeId,
  applicantUserId,
  applicantOrgId,
  initial,
  applicantJoined = false,
  defaultTeamName,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [app, setApp] = useState<Application | null>(initial);
  const [teamName, setTeamName] = useState(initial?.team_name || defaultTeamName);
  const [members, setMembers] = useState(initial?.members ?? "");
  // 構造化フィールド
  const [proposalSummary, setProposalSummary] = useState(
    initial?.proposal_summary ?? initial?.proposal ?? "",
  );
  const [planWhy, setPlanWhy] = useState(initial?.plan_why ?? "");
  const [planWho, setPlanWho] = useState(initial?.plan_who ?? "");
  const [planWhat, setPlanWhat] = useState(initial?.plan_what ?? "");
  const [planHow, setPlanHow] = useState(initial?.plan_how ?? "");
  const [planWhere, setPlanWhere] = useState(initial?.plan_where ?? "");
  const [schedule, setSchedule] = useState(initial?.schedule ?? "");
  const [budgetPlan, setBudgetPlan] = useState(initial?.budget_plan ?? "");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(applicantJoined);

  // 採択 / 却下後の status 変化 (approved / rejected / project_id 付与) を
  // server からの prop で受け取った時にローカル state へ同期する。
  // 編集中フィールド (teamName 等) はユーザの入力を上書きしないよう、
  // 既に編集に入っているなら同期しない。 initial.id が変わったときだけ全同期。
  const lastInitialIdRef = useRef<string | null>(initial?.id ?? null);
  useEffect(() => {
    if (!initial) return;
    if (lastInitialIdRef.current !== initial.id) {
      setApp(initial);
      setTeamName(initial.team_name || defaultTeamName);
      setMembers(initial.members ?? "");
      setProposalSummary(initial.proposal_summary ?? initial.proposal ?? "");
      setPlanWhy(initial.plan_why ?? "");
      setPlanWho(initial.plan_who ?? "");
      setPlanWhat(initial.plan_what ?? "");
      setPlanHow(initial.plan_how ?? "");
      setPlanWhere(initial.plan_where ?? "");
      setSchedule(initial.schedule ?? "");
      setBudgetPlan(initial.budget_plan ?? "");
      lastInitialIdRef.current = initial.id;
    } else {
      // 同じ申請の status だけ更新 (採択 / 却下が通知された)
      setApp((prev) => (prev ? { ...prev, ...initial } : initial));
    }
  }, [initial, defaultTeamName]);

  useEffect(() => {
    setJoined(applicantJoined);
  }, [applicantJoined]);

  const joinProject = async () => {
    if (!app?.created_project_id) return;
    setJoining(true);
    setError(null);
    // 既に参加済みでないかを念のため確認
    const { data: existing } = await supabase
      .from("project_memberships")
      .select("user_id")
      .eq("project_id", app.created_project_id)
      .eq("user_id", applicantUserId)
      .maybeSingle();
    if (!existing) {
      const { error: pmErr } = await supabase
        .from("project_memberships")
        .insert({
          project_id: app.created_project_id,
          user_id: applicantUserId,
          role: "lead",
        });
      if (pmErr) {
        setJoining(false);
        setError(`参加に失敗しました: ${pmErr.message}`);
        return;
      }
    }
    setJoined(true);
    setJoining(false);
    router.push(`/${orgSlug}/projects/${app.created_project_id}/dashboard`);
    router.refresh();
  };

  const status: AppStatus = app?.status ?? "draft";
  const editable = status === "draft";
  const meta = STATUS_META[status];

  const upsert = async (
    nextStatus: AppStatus,
    extra: Partial<Application> = {},
  ) => {
    setError(null);
    const payload: Partial<Application> = {
      theme_id: themeId,
      applicant_user_id: applicantUserId,
      applicant_org_id: applicantOrgId,
      team_name: teamName.trim() || defaultTeamName,
      members: members.trim() || null,
      proposal_summary: proposalSummary.trim() || null,
      plan_why: planWhy.trim() || null,
      plan_who: planWho.trim() || null,
      plan_what: planWhat.trim() || null,
      plan_how: planHow.trim() || null,
      plan_where: planWhere.trim() || null,
      schedule: schedule.trim() || null,
      budget_plan: budgetPlan.trim() || null,
      // legacy proposal は概要を保存しておく (旧 UI 互換)
      proposal: proposalSummary.trim() || null,
      status: nextStatus,
      ...extra,
    };
    if (app) {
      const { data, error: err } = await supabase
        .from("theme_applications")
        .update(payload as never)
        .eq("id", app.id)
        .select()
        .single();
      if (err || !data) {
        setError(err?.message ?? "保存に失敗しました");
        return null;
      }
      setApp(data);
      return data;
    } else {
      const { data, error: err } = await supabase
        .from("theme_applications")
        .insert(payload as never)
        .select()
        .single();
      if (err || !data) {
        setError(err?.message ?? "応募の作成に失敗しました");
        return null;
      }
      setApp(data);
      return data;
    }
  };

  const saveDraft = async () => {
    setSaving(true);
    const r = await upsert("draft");
    setSaving(false);
    if (r) setSavedAt(Date.now());
  };

  const submitApp = async () => {
    setSubmitting(true);
    const r = await upsert("submitted", {
      submitted_at: new Date().toISOString(),
    });
    setSubmitting(false);
    if (r) {
      setConfirm(false);
      router.push(`/${orgSlug}/themes/applications`);
      router.refresh();
    }
  };

  const withdraw = async () => {
    if (!confirm) return;
  };

  const withdrawConfirm = async () => {
    if (!window.confirm("応募を取り下げますか？再度応募する場合は新しく作成してください。"))
      return;
    setSaving(true);
    const r = await upsert("withdrawn", {});
    setSaving(false);
    if (r) router.push(`/${orgSlug}/themes`);
  };

  const justSaved = savedAt !== null && Date.now() - savedAt < 2500;
  // 全構造化フィールドの合計文字数で応募可否を判定
  const totalChars =
    proposalSummary.trim().length +
    planWhy.trim().length +
    planWho.trim().length +
    planWhat.trim().length +
    planHow.trim().length +
    planWhere.trim().length +
    schedule.trim().length +
    budgetPlan.trim().length;
  const canSubmit =
    totalChars >= 100 &&
    teamName.trim().length > 0 &&
    proposalSummary.trim().length > 0 &&
    planWhy.trim().length > 0 &&
    planWho.trim().length > 0 &&
    planWhat.trim().length > 0 &&
    planHow.trim().length > 0 &&
    schedule.trim().length > 0 &&
    budgetPlan.trim().length > 0;

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="t-h2">
            <span aria-hidden className="mr-2">
              ✦
            </span>
            応募内容
          </h2>
          <p className="t-cap mt-0.5">
            チーム名・メンバー・提案を記入して応募してください。
          </p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-[11px] font-bold text-white"
          style={{ background: meta.bg }}
        >
          {meta.emo} {meta.label}
        </span>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 mb-3">
          {error}
        </div>
      )}

      <label className="block mb-3">
        <span className="t-label block mb-1">チーム名 *</span>
        <input
          type="text"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          disabled={!editable}
          placeholder="例: NEW LINE"
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-[--c-accent] disabled:opacity-60"
        />
      </label>

      <label className="block mb-4">
        <span className="t-label block mb-1">メンバー構成（任意）</span>
        <input
          type="text"
          value={members}
          onChange={(e) => setMembers(e.target.value)}
          disabled={!editable}
          placeholder="例: 三木 (PdM) / 高橋 (現場リサーチ) / 山田 (デザイン)"
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-[--c-accent] disabled:opacity-60"
        />
      </label>

      {/* === 提案概要 === */}
      <h3 className="t-h3 mt-5 mb-2">
        <span aria-hidden className="mr-1.5">
          📝
        </span>
        提案概要
        <span className="ml-2 t-cap font-normal text-mute">必須</span>
      </h3>
      <FormTextarea
        value={proposalSummary}
        onChange={setProposalSummary}
        disabled={!editable}
        rows={3}
        placeholder="この応募の 30 秒ピッチ。何を、誰に、どう届けるかを 2〜3 文で。"
      />

      {/* === 実行計画 (Why/Who/What/How) === */}
      <h3 className="t-h3 mt-5 mb-2">
        <span aria-hidden className="mr-1.5">
          🎯
        </span>
        実行計画
        <span className="ml-2 t-cap font-normal text-mute">
          Why / Who / What / How をそれぞれ
        </span>
      </h3>
      <FormSection
        label="💡 Why — このテーマに取り組む理由"
        value={planWhy}
        onChange={setPlanWhy}
        disabled={!editable}
        placeholder="なぜ私たちが取り組むのか。チームの原体験 / 社会的意義 / 自分ごと化のストーリー。"
      />
      <FormSection
        label="🧑‍🤝‍🧑 Who — ターゲット (誰の・どんな状況)"
        value={planWho}
        onChange={setPlanWho}
        disabled={!editable}
        placeholder="受益者・関係者の具体的な姿。年齢・属性・直面している状況・現場の声。"
      />
      <FormSection
        label="💎 What — 提供価値 (相手が得る変化)"
        value={planWhat}
        onChange={setPlanWhat}
        disabled={!editable}
        placeholder="プロダクト名ではなく、相手にとって何が良くなるか。行動 / 感情 / 関係性の変化。"
      />
      <FormSection
        label="🛠 How — 実現方法 (具体的なアクション)"
        value={planHow}
        onChange={setPlanHow}
        disabled={!editable}
        placeholder="提供価値を実現する手段 / プロセス / 必要なリソース。"
      />

      {/* === 実証計画 (いつ・どこで・何をするか) === */}
      <h3 className="t-h3 mt-5 mb-2">
        <span aria-hidden className="mr-1.5">
          🧪
        </span>
        実証計画
        <span className="ml-2 t-cap font-normal text-mute">必須</span>
      </h3>
      <p className="t-cap mb-2 leading-relaxed">
        事業をテストするための実証 (PoC) を「いつ・どこで・何をするか」で書きます。現時点の想定で OK、進めるうちに変わって構いません。
      </p>
      <FormTextarea
        value={schedule}
        onChange={setSchedule}
        disabled={!editable}
        rows={6}
        placeholder={
          "例:\n[いつ] M+1〜M+3 の 3 ヶ月で実証\n[どこで] 福岡市内の介護施設 A 拠点 (利用者 30 名)\n[何を] パートナー型ロボット Humo を導入し、会話量 / ケア時間 / 家族満足度を 8 週間計測。導入前後の比較で「人らしさを失わない介護」が成立するかを検証。\n[誰と] 施設長 + ケアマネ 2 名 + 家族 5 組と毎週レビュー"
        }
      />

      {/* === 収支計画 (スプレッドシート) === */}
      <h3 className="t-h3 mt-5 mb-2">
        <span aria-hidden className="mr-1.5">
          💴
        </span>
        収支計画
        <span className="ml-2 t-cap font-normal text-mute">必須</span>
      </h3>
      <p className="t-cap mb-2 leading-relaxed">
        事業全体の <strong>月次 (半年以上)</strong> の収支計画。表に直接入力してください。月末残・累計は自動計算。単位は万円。
      </p>
      <BudgetPlanGrid
        value={budgetPlan}
        onChange={setBudgetPlan}
        disabled={!editable}
      />

      <p className="t-cap mt-4 mb-2">
        合計 <strong className="text-ink">{totalChars}</strong> 文字 ・ 100
        文字以上 + 必須項目 (概要 / Why / Who / What / How / 実証計画 / 収支計画) で応募可
      </p>

      {/* 合格通知 + プロジェクト参加ボタン */}
      {status === "approved" && app?.created_project_id && (
        <div
          className="rounded-xl p-4 mb-3"
          style={{
            background:
              "linear-gradient(135deg, rgba(10,135,84,.12), rgba(40,180,120,.18))",
            borderLeft: "4px solid var(--ok)",
          }}
        >
          <div className="flex items-start gap-3 mb-3 flex-wrap">
            <div className="text-2xl" aria-hidden>
              🎉
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[15px] font-bold mb-1">
                合格しました！
              </h3>
              <p className="text-[12.5px] leading-relaxed">
                {app.project_started_at
                  ? "テーマオーナーがプロジェクトをスタートしました。下の「プロジェクトに参加」を押してリーダーとして参加してください。"
                  : "テーマオーナーがプロジェクトを起動するのを待っています。起動されると「プロジェクトに参加」ボタンが押せるようになります。"}
              </p>
            </div>
          </div>

          {app.decision_note && (
            <div className="rounded-md bg-white/70 p-3 mb-3">
              <div className="t-label mb-1">主催側のコメント</div>
              <p className="text-[12.5px] leading-relaxed">
                {app.decision_note}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end">
            {joined ? (
              <a
                href={`/${orgSlug}/projects/${app.created_project_id}/dashboard`}
                className="rounded-full bg-ink px-5 py-2 text-[12.5px] font-bold text-white hover:opacity-90"
              >
                → ダッシュへ
              </a>
            ) : (
              <button
                type="button"
                onClick={joinProject}
                disabled={!app.project_started_at || joining}
                className="rounded-full px-5 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50"
                style={{
                  background: app.project_started_at
                    ? "linear-gradient(135deg, var(--ok), #0a8754)"
                    : "var(--mute)",
                  cursor: app.project_started_at ? "pointer" : "not-allowed",
                }}
              >
                {joining
                  ? "..."
                  : app.project_started_at
                    ? "✦ プロジェクトに参加"
                    : "起動を待っています…"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 不採択コメント */}
      {status === "rejected" && app?.decision_note && (
        <div
          className="rounded-lg p-3 mb-3"
          style={{
            background: "rgba(192,57,43,.08)",
            borderLeft: "4px solid var(--error)",
          }}
        >
          <div className="t-label mb-1">主催側のコメント</div>
          <p className="text-[12.5px] leading-relaxed">{app.decision_note}</p>
        </div>
      )}

      {editable && (
        <div className="rounded-lg bg-accent-soft/40 p-3 mb-3 text-[12px] leading-relaxed">
          💡 「下書き保存」で進捗を保存できます。応募後は内容を編集できないため、
          応募ボタンの後に確認ダイアログが出ます。
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="t-cap">
          {justSaved && (
            <span className="text-[--c-accent-deep]">✓ 保存しました</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {editable ? (
            <>
              <button
                type="button"
                onClick={saveDraft}
                disabled={saving || submitting}
                className="rounded-lg bg-white border border-line px-4 py-2 text-sm font-medium text-mute hover:bg-mute/5 disabled:opacity-50"
              >
                {saving ? "..." : "💾 下書き保存"}
              </button>
              <button
                type="button"
                onClick={() => setConfirm(true)}
                disabled={!canSubmit || submitting}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
              >
                ✦ 応募する
              </button>
            </>
          ) : status === "submitted" || status === "under_review" ? (
            <button
              type="button"
              onClick={withdrawConfirm}
              disabled={saving}
              className="rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-error hover:bg-red-100"
            >
              ↩ 取下げる
            </button>
          ) : null}
        </div>
      </div>

      {/* 応募確認ダイアログ */}
      {confirm && (
        <>
          <button
            type="button"
            onClick={() => setConfirm(false)}
            className="fixed inset-0 z-40 bg-ink/30"
            aria-label="閉じる"
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
            <GlassCard variant="strong" className="p-6 animate-risein">
              <div className="text-4xl text-center mb-3">✉️</div>
              <h3 className="t-h2 text-center mb-2">この内容で応募しますか？</h3>
              <p className="t-cap text-center mb-4 leading-relaxed">
                応募後は <strong>主催の審査が始まり、内容の編集はできなくなります</strong>。
                取下げのみ可能です。
              </p>
              <div className="rounded-lg bg-canvas-2 p-3 mb-4 t-cap leading-relaxed">
                <div>
                  <strong>チーム:</strong> {teamName || "（未入力）"}
                </div>
                {members && (
                  <div className="mt-1">
                    <strong>メンバー:</strong> {members}
                  </div>
                )}
                <div className="mt-1">
                  <strong>提案文字数:</strong> {totalChars}
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setConfirm(false)}
                  className="rounded-lg bg-white border border-line px-4 py-2 text-sm font-medium text-mute"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={submitApp}
                  disabled={submitting}
                  className="rounded-lg bg-ink px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? "送信中..." : "✦ 応募を送信"}
                </button>
              </div>
            </GlassCard>
          </div>
        </>
      )}
    </GlassCard>
  );
}

function FormTextarea({
  value,
  onChange,
  placeholder,
  disabled,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
}) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-[--c-accent] resize-y leading-relaxed disabled:opacity-60 whitespace-pre-wrap mb-3"
    />
  );
}

function FormSection({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block mb-3">
      <span className="t-label block mb-1">{label}</span>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-[--c-accent] resize-y leading-relaxed disabled:opacity-60"
      />
    </label>
  );
}
