"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import type { Database } from "@/lib/types/database";

type Application = Database["public"]["Tables"]["theme_applications"]["Row"];
type AppStatus = Application["status"];

interface Props {
  orgSlug: string;
  themeId: string;
  applicantUserId: string;
  applicantOrgId: string;
  initial: Application | null;
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
  defaultTeamName,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [app, setApp] = useState<Application | null>(initial);
  const [teamName, setTeamName] = useState(initial?.team_name || defaultTeamName);
  const [members, setMembers] = useState(initial?.members ?? "");
  const [proposal, setProposal] = useState(initial?.proposal ?? "");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

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
      proposal: proposal.trim() || null,
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
  const canSubmit = proposal.trim().length >= 50 && teamName.trim().length > 0;

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

      <label className="block mb-3">
        <span className="t-label block mb-1">メンバー（任意）</span>
        <input
          type="text"
          value={members}
          onChange={(e) => setMembers(e.target.value)}
          disabled={!editable}
          placeholder="例: 三木, 高橋, 山田"
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-[--c-accent] disabled:opacity-60"
        />
      </label>

      <label className="block mb-3">
        <span className="t-label block mb-1">
          提案内容 *
          <span className="ml-2 t-cap font-normal">
            （{proposal.length} 文字 ・ 50文字以上で応募可）
          </span>
        </span>
        <textarea
          rows={10}
          value={proposal}
          onChange={(e) => setProposal(e.target.value)}
          disabled={!editable}
          placeholder={
            "・このテーマに取り組みたい理由（Why）\n・誰のどんな課題に向き合うか（Who / Pain）\n・どんな解決策をつくるか（What）\n・どう実現するか（How）\n・期待される成果\n\n400-1500 文字程度を推奨"
          }
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-[--c-accent] resize-y leading-relaxed disabled:opacity-60"
        />
      </label>

      {app?.decision_note && (
        <div
          className="rounded-lg p-3 mb-3"
          style={{
            background:
              status === "approved" ? "rgba(10,135,84,.1)" : "rgba(192,57,43,.08)",
            borderLeft: `4px solid ${
              status === "approved" ? "var(--ok)" : "var(--error)"
            }`,
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
          {app?.created_project_id && (
            <a
              href={`/${orgSlug}/dashboard?p=${app.created_project_id}`}
              className="text-[--c-accent-deep] underline"
            >
              → 組成されたプロジェクトを開く
            </a>
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
                  <strong>提案文字数:</strong> {proposal.length}
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
