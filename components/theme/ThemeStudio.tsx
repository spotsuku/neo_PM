"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { ThemePublicView } from "@/components/themes/ThemePublicView";
import { ThemeReviewPanel } from "@/components/theme/ThemeReviewPanel";
import {
  ThemeCollaboratorsPanel,
  type CollaboratorRow,
  type OrgMemberOption,
} from "@/components/theme/ThemeCollaboratorsPanel";
import { ThemeHistoryPanel } from "@/components/theme/ThemeHistoryPanel";
import { themeStatusMeta } from "@/lib/themeStatus";
import {
  THEME_SCORE_ITEMS,
  THEME_SCORE_TARGET,
  THEME_SCORE_THRESHOLD,
  parseThemeAiScores,
  themeItemsBelowThreshold,
  themeScoreTier,
  type ThemeAiScores,
} from "@/lib/themeScore";
import type { Database } from "@/lib/types/database";

type Theme = Database["public"]["Tables"]["themes"]["Row"];
type ReviewDecisionRow = {
  item_key: string;
  decision: "approved" | "changes_requested";
  comment: string | null;
};

interface Props {
  orgSlug: string;
  orgId: string;
  orgName: string;
  initialTheme: Theme;
  currentUserId: string;
  canManageAll: boolean;
  currentProjectId?: string | null;
  /** 差し戻し時の項目別コメント (出題者に表示) */
  reviewComments?: { item_key: string; comment: string | null }[];
  /** 既存の項目別審査結果 (審査パネルの初期値) */
  reviewDecisions?: ReviewDecisionRow[];
  /** 共同編集者 / 閲覧者 */
  collaborators?: CollaboratorRow[];
  /** 追加候補となる組織メンバー (display_name / avatar 付き) */
  orgMembers?: OrgMemberOption[];
  /** 採点者選択ドロップダウンの候補 (owner / admin のみ) */
  orgAdmins?: { user_id: string; display_name: string | null }[];
  /** current user は editor 権限の collaborator か (canEdit に効く) */
  isCollaboratorEditor?: boolean;
  /** collaborators パネルの追加/削除を行えるか (出題者 or 組織管理者) */
  canManageCollaborators?: boolean;
}

const THEME_ITEM_LABEL: Record<string, string> = {
  image: "サムネ画像",
  title: "課題テーマタイトル",
  criteria: "NEO 3基準",
  description_long: "課題テーマ概要",
  vision: "プロジェクトのビジョン（達成したい状態とその状態を表す目標数値）",
  current_state: "現状",
  pain: "問題（ビジョンと現状のギャップ）",
  root_cause: "問題が起きている要因",
  focus_issue: "取り組むべき課題",
  background: "WHY（背景）",
  who_target: "WHO（ターゲット）",
  what_benefit: "WHAT（提供価値）",
  expected_outcome: "期待される成果",
  what_uniqueness: "独自性",
  internal_challenges: "実装する上でのリスク",
  resources: "提供リソース",
  post_action: "採択後のアクション",
};

export function ThemeStudio({
  orgSlug,
  orgName,
  initialTheme,
  currentUserId,
  canManageAll,
  reviewComments = [],
  reviewDecisions = [],
  collaborators = [],
  orgMembers = [],
  orgAdmins = [],
  isCollaboratorEditor = false,
  canManageCollaborators = false,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiScoring, setAiScoring] = useState(false);
  const [aiScores, setAiScores] = useState<ThemeAiScores | null>(() =>
    parseThemeAiScores(initialTheme.ai_scores),
  );
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // 親 props が ?t= 切替で変わったら同期
  const lastIdRef = useRef(initialTheme.id);
  useEffect(() => {
    if (initialTheme.id !== lastIdRef.current) {
      setTheme(initialTheme);
      setAiScores(parseThemeAiScores(initialTheme.ai_scores));
      lastIdRef.current = initialTheme.id;
    }
  }, [initialTheme]);

  // beforeunload: 保留中の保存があればブラウザに警告ダイアログを出す。
  // 「ページを離れる」を押した場合は best-effort で flush を発火させる。
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingPatchesRef.current.size === 0) return;
      // Chrome では returnValue を設定すると警告が出る
      e.preventDefault();
      e.returnValue = "保存中の変更があります。離れてもよろしいですか？";
      // best-effort: 同期で flush を投げる (await はできないが
      // ブラウザがリクエストを送る猶予があれば届く)
      void flushPending();
      return e.returnValue;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // unmount cleanup: 残っているタイマー期限前に保留 patch を即時 flush する。
  // これがないと、React のクリーンアップが clearTimeout してしまい
  // データロスが起きる (報告された「下部に書いた情報が消える」の原因)。
  useEffect(
    () => () => {
      void flushPending();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const isPoster = theme.posted_by === currentUserId;
  const isEditableStatus =
    theme.status === "draft" || theme.status === "changes_requested";
  // 編集できるのは作成者本人 または 共同編集者 (editor)。
  // 管理者でも他人のテーマは編集できない (プレビュー+審査のみ)。
  const canEdit =
    (isPoster || isCollaboratorEditor) && isEditableStatus && !theme.is_demo;
  const statusMeta = themeStatusMeta(theme.status);

  // 審査モード: 管理者が「審査中(submitted)」のテーマを開いている時。
  // 右カラムを編集フォームの代わりに審査パネルにする。
  const reviewerMode = canManageAll && theme.status === "submitted";
  // 出題者向け差し戻し表示: 記載中(draft) / 差し戻し(changes_requested) の間は
  // 前回の差し戻しコメントを残して表示する (永続化された review_decisions より)。
  const showReviewNotes =
    theme.status === "draft" || theme.status === "changes_requested";
  const initialDecisions = useMemo(() => {
    const map: Record<
      string,
      { decision: "approved" | "changes_requested"; comment: string | null }
    > = {};
    for (const d of reviewDecisions) {
      map[d.item_key] = { decision: d.decision, comment: d.comment };
    }
    return map;
  }, [reviewDecisions]);

  // デバウンス自動保存 (編集可能時のみ)
  //
  // 注: タイマー期限前にユーザがページを離脱すると、cleanup で
  // clearTimeout され保存が走らないままになりデータロスが起きる。
  // 対策として:
  //   - pendingPatchesRef に直近の patch を貯めておき、離脱時に
  //     beforeunload で警告 + best-effort で flush する
  //   - デバウンスを 300ms に短縮 (元: 600ms)
  const DEBOUNCE_MS = 300;
  const pendingPatchesRef = useRef<Map<string, Partial<Theme>>>(new Map());

  const flushPending = async () => {
    const entries = Array.from(pendingPatchesRef.current.entries());
    pendingPatchesRef.current.clear();
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current.clear();
    if (entries.length === 0) return;
    // 同一テーマへの patch を1つに merge してネットワーク削減
    const merged: Partial<Theme> = entries.reduce(
      (acc, [, p]) => ({ ...acc, ...p }),
      {},
    );
    await supabase
      .from("themes")
      .update(merged as never)
      .eq("id", theme.id);
  };

  const patch = (p: Partial<Theme>) => {
    if (!canEdit) return;
    setTheme((prev) => ({ ...prev, ...p }));
    const tkey = `${theme.id}:${Object.keys(p).join(",")}`;
    pendingPatchesRef.current.set(tkey, p);
    const existing = timersRef.current.get(tkey);
    if (existing) clearTimeout(existing);
    setSavingFields((prev) => new Set(prev).add(tkey));
    const tm = setTimeout(async () => {
      const { error: err } = await supabase
        .from("themes")
        .update(p as never)
        .eq("id", theme.id);
      // 成功/失敗いずれも pending から外す (失敗時は setError で表示)
      pendingPatchesRef.current.delete(tkey);
      setSavingFields((prev) => {
        const next = new Set(prev);
        next.delete(tkey);
        return next;
      });
      setError(err ? err.message : null);
      // 保存成功時に履歴スナップショットも取る。
      // RPC 側で 60 秒以内の連続 autosave はスキップされるため、
      // クライアントで間引かなくても履歴は適切な粒度になる。
      if (!err) {
        void supabase.rpc("snapshot_theme", {
          p_theme_id: theme.id,
          p_source: "autosave",
        });
      }
    }, DEBOUNCE_MS);
    timersRef.current.set(tkey, tm);
  };

  // サムネ画像アップロード (Storage → patch で URL を保存)
  const uploadThumbnail = async (file: File) => {
    if (!canEdit) return;
    if (!file.type.startsWith("image/")) {
      setError("画像ファイルを選んでください");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("5MB 以下の画像を選んでください");
      return;
    }
    setUploadingThumb(true);
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `theme-thumbnails/${theme.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("project-posts")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploadingThumb(false);
      setError(`アップロード失敗: ${upErr.message}`);
      return;
    }
    const { data: pub } = supabase.storage
      .from("project-posts")
      .getPublicUrl(path);
    setUploadingThumb(false);
    patch({
      thumbnail_url: pub.publicUrl,
      thumbnail_zoom: 1,
      thumbnail_offset_x: 0,
      thumbnail_offset_y: 0,
    });
  };

  const clearThumbnail = () => {
    if (!canEdit) return;
    patch({
      thumbnail_url: null,
      thumbnail_zoom: 1,
      thumbnail_offset_x: 0,
      thumbnail_offset_y: 0,
    });
  };

  // 即時更新 (ワークフロー操作)
  const applyNow = async (updates: Partial<Theme>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("themes")
      .update(updates as never)
      .eq("id", theme.id);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setTheme((prev) => ({ ...prev, ...updates }));
    router.refresh();
  };

  const submit = async () => {
    if (!theme.title.trim()) {
      setError("タイトルを入力してから申請してください。");
      return;
    }
    if (aiScoring || busy) return;
    setError(null);
    setAiScoring(true);
    let scores: ThemeAiScores | null = null;
    try {
      const res = await fetch("/api/ai/score-theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeId: theme.id }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        scores?: unknown;
        error?: string;
      };
      setAiScoring(false);
      if (!res.ok || !data.ok) {
        setError(data.error ?? `AI 採点に失敗しました (${res.status})`);
        return;
      }
      scores = parseThemeAiScores(data.scores);
      setAiScores(scores);
    } catch (e) {
      setAiScoring(false);
      setError(e instanceof Error ? e.message : "AI 採点の通信に失敗しました");
      return;
    }

    const below = themeItemsBelowThreshold(scores);
    if (below.length > 0) {
      setError(
        `申請には全 ${THEME_SCORE_ITEMS.length} 項目が ${THEME_SCORE_THRESHOLD} 点以上必要です。` +
          `未達の項目: ${below.map((b) => `${b.label}（${b.score}点）`).join("、")}。` +
          "下の AI 採点の指摘を参考に修正してください。",
      );
      return;
    }
    const belowTarget = scores
      ? THEME_SCORE_ITEMS.filter(
          (it) => (scores.items[it.key]?.score ?? 0) < THEME_SCORE_TARGET,
        ).length
      : 0;
    const confirmMsg =
      belowTarget === 0
        ? `🎯 全項目が目標水準（${THEME_SCORE_TARGET}点）を達成しました。\nこのテーマを申請します。申請後は審査が終わるまで編集できません。よろしいですか？`
        : `✓ 申請水準（${THEME_SCORE_THRESHOLD}点）はクリアしました。\n${belowTarget} 項目が目標水準（${THEME_SCORE_TARGET}点）に届いていません。このまま申請しますか？\n申請後は審査が終わるまで編集できません。`;
    if (!window.confirm(confirmMsg)) return;
    applyNow({ status: "submitted", submitted_at: new Date().toISOString() });
  };

  const withdraw = () => {
    if (!window.confirm("申請を取り下げて記載中に戻します。よろしいですか？"))
      return;
    applyNow({ status: "draft" });
  };

  const setActiveStatus = (status: Theme["status"], confirmMsg: string) => {
    if (!window.confirm(confirmMsg)) return;
    applyNow({ status });
  };

  // 承認済 (approved) → 公開 (active) : 出題者 or 管理者
  const publishApproved = () => {
    if (
      !window.confirm(
        "このテーマを公開します。応募者に一覧で見えるようになります。よろしいですか?",
      )
    )
      return;
    applyNow({ status: "active" });
  };

  // 承認済 → 下書きに戻す (公開せず修正したい時)
  const revertApprovedToDraft = () => {
    if (
      !window.confirm(
        "承認済みのテーマを下書きに戻します。編集後に再度申請してください。",
      )
    )
      return;
    applyNow({ status: "draft" });
  };

  // 公開中 → 下書きへ戻す (出題者本人 or 管理者)
  const revertToDraft = () => {
    if (
      !window.confirm(
        "公開を停止して下書きに戻します。応募者からは見えなくなり、編集後に再申請が必要です。よろしいですか？",
      )
    )
      return;
    applyNow({ status: "draft" });
  };

  // 公開中 → 承認済 (非公開) へ戻す (出題者本人 or 管理者)
  // 内容はそのまま、応募者から見えなくするだけ。「🚀 公開する」で再度公開できる。
  const unpublishToApproved = () => {
    const msg = theme.is_demo
      ? "⚠️ これは見本テーマです。非公開にすると新規メンバー向けのオンボーディング体験に影響する可能性があります。\n\nそれでも非公開に戻しますか？"
      : "このテーマを非公開に戻します。応募者からは見えなくなりますが、承認状態は保たれます。「🚀 公開する」ボタンでいつでも再公開できます。";
    if (!window.confirm(msg)) return;
    applyNow({ status: "approved" });
  };

  const canDelete = (canManageAll || isPoster) && !theme.is_demo;
  const deleteCurrent = async () => {
    if (!canDelete) return;
    const phrase = `${theme.title} を削除`;
    const input = window.prompt(
      `テーマ「${theme.title}」を削除します。\n\n` +
        "応募・採択結果も含めて関連データが消えます。元に戻せません。\n\n" +
        `続行するには「${phrase}」と入力してください。`,
    );
    if (input !== phrase) {
      if (input !== null) alert("入力が一致しませんでした。削除を中止しました。");
      return;
    }
    const { error: err } = await supabase
      .from("themes")
      .delete()
      .eq("id", theme.id);
    if (err) {
      setError(`削除に失敗しました: ${err.message}`);
      return;
    }
    router.push(`/${orgSlug}/theme`);
    router.refresh();
  };

  const anySaving = savingFields.size > 0;

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {/* Header */}
      <GlassCard className="p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/${orgSlug}/theme`}
            className="grid h-9 w-9 place-items-center rounded-full bg-white border border-line text-mute hover:text-ink shrink-0"
            title="一覧に戻る"
          >
            ←
          </Link>
          <div className="min-w-0">
            <h1 className="text-[18px] font-extrabold tracking-tight truncate">
              {theme.title || "（無題のテーマ）"}
            </h1>
            <div className="t-cap truncate">{orgName} ・ テーマ出題</div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold text-white"
            style={{ background: statusMeta.color }}
          >
            {statusMeta.emo} {statusMeta.label}
          </span>
          {canEdit && (
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
          )}
          {canDelete && (
            <button
              type="button"
              onClick={deleteCurrent}
              className="rounded-full bg-white border border-line px-3 py-1.5 text-[11.5px] font-semibold text-mute hover:text-error hover:bg-red-50"
            >
              🗑 削除
            </button>
          )}
          {!theme.is_demo && (
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="rounded-full bg-white border border-line px-3 py-1.5 text-[11.5px] font-semibold text-mute hover:text-ink"
              title="編集履歴を見る / この時点に戻す"
            >
              🕒 履歴
            </button>
          )}
          <Link
            href={`/${orgSlug}/themes/applications`}
            className="rounded-full bg-white px-4 py-1.5 text-[11.5px] font-semibold text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)]"
          >
            📋 応募の管理 →
          </Link>
        </div>
      </GlassCard>

      <ThemeHistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        themeId={theme.id}
        canRestore={canEdit}
      />

      <ThemeFullscreenPreview
        open={fullscreenPreview}
        onClose={() => setFullscreenPreview(false)}
        theme={theme}
        orgName={orgName}
      />

      {showReviewNotes &&
        (theme.review_note || reviewComments.some((c) => c.comment)) && (
          <div className="rounded-md border-l-2 border-warn bg-warn/5 px-3 py-2">
            <div className="flex items-baseline gap-x-2 gap-y-0.5 flex-wrap">
              <span className="text-[12px] font-bold">↩ 差し戻し</span>
              {reviewComments
                .filter((c) => c.comment)
                .map((c, i, arr) => (
                  <span
                    key={c.item_key}
                    className="text-[11px] text-mute"
                  >
                    {THEME_ITEM_LABEL[c.item_key] ?? c.item_key}
                    {i < arr.length - 1 && (
                      <span className="ml-1.5 opacity-50">/</span>
                    )}
                  </span>
                ))}
              {reviewComments.some((c) => c.comment) && (
                <span className="text-[10.5px] text-mute opacity-70 ml-auto">
                  各項目のコメントは入力欄下に表示
                </span>
              )}
            </div>
            {theme.review_note && (
              <div className="mt-1 text-[11.5px] leading-relaxed whitespace-pre-wrap">
                {theme.review_note}
              </div>
            )}
          </div>
        )}

      {/* ワークフロー */}
      <GlassCard className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="t-cap">{statusMeta.hint}</div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* 出題者: 申請 / 取り下げ */}
            {isPoster && isEditableStatus && !theme.is_demo && (
              <button
                type="button"
                onClick={submit}
                disabled={busy || aiScoring}
                className="rounded-full bg-ink px-5 py-2 text-[12px] font-bold text-white hover:opacity-90 disabled:opacity-50"
              >
                {aiScoring ? "🤖 AI 採点中..." : "📨 申請する"}
              </button>
            )}
            {isPoster && theme.status === "submitted" && (
              <button
                type="button"
                onClick={withdraw}
                disabled={busy}
                className="rounded-full bg-white border border-line px-4 py-2 text-[12px] font-semibold text-mute hover:text-ink disabled:opacity-50"
              >
                取り下げ
              </button>
            )}
            {/* 管理者: 審査 → 右の審査パネルで項目ごとにコメント */}
            {reviewerMode && (
              <span className="t-cap">
                👉 右の審査パネルで項目ごとにコメントを付けて、承認 / 差し戻しできます。
              </span>
            )}
            {/* 承認済 (未公開): 出題者 or 管理者 が「公開」ボタンで公開に踏み切る */}
            {(canManageAll || isPoster) &&
              theme.status === "approved" &&
              !theme.is_demo && (
                <>
                  <button
                    type="button"
                    onClick={publishApproved}
                    disabled={busy}
                    className="rounded-full bg-emerald-600 px-5 py-2 text-[12px] font-bold text-white hover:opacity-90 disabled:opacity-50"
                    title="応募者に一覧で見えるようにします"
                  >
                    🚀 公開する
                  </button>
                  <button
                    type="button"
                    onClick={revertApprovedToDraft}
                    disabled={busy}
                    className="rounded-full bg-white border border-line px-4 py-2 text-[12px] font-semibold text-mute hover:text-ink disabled:opacity-50"
                    title="公開せず、修正するために下書きに戻します"
                  >
                    📝 下書きに戻して修正
                  </button>
                </>
              )}
            {/* 公開後: 非公開に戻す (出題者本人 or 管理者) — 内容そのまま、再公開しやすい */}
            {(canManageAll || isPoster) &&
              theme.status === "active" &&
              !theme.is_demo && (
                <button
                  type="button"
                  onClick={unpublishToApproved}
                  disabled={busy}
                  className="rounded-full bg-amber-50 border border-amber-200 px-4 py-2 text-[12px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                  title="内容はそのまま、応募者に見えなくします (再公開OK)"
                >
                  🔒 非公開に戻す
                </button>
              )}
            {/* 公開後: 下書きに戻して編集 (出題者本人 or 管理者) */}
            {(canManageAll || isPoster) &&
              theme.status === "active" &&
              !theme.is_demo && (
                <button
                  type="button"
                  onClick={revertToDraft}
                  disabled={busy}
                  className="rounded-full bg-white border border-line px-4 py-2 text-[12px] font-semibold text-mute hover:text-ink disabled:opacity-50"
                  title="公開を止めて下書きに戻します (編集後に再申請が必要)"
                >
                  📝 下書きに戻して編集
                </button>
              )}
            {/* 管理者: 公開後の終了/アーカイブ */}
            {canManageAll && theme.status === "active" && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setActiveStatus("closed", "募集を終了しますか？")
                  }
                  disabled={busy}
                  className="rounded-full bg-white border border-line px-4 py-2 text-[12px] font-semibold text-mute hover:text-ink disabled:opacity-50"
                >
                  📦 終了
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveStatus("archived", "アーカイブしますか？")
                  }
                  disabled={busy}
                  className="rounded-full bg-white border border-line px-4 py-2 text-[12px] font-semibold text-mute hover:text-ink disabled:opacity-50"
                >
                  🗄 アーカイブ
                </button>
              </>
            )}
          </div>
        </div>

        {theme.status === "submitted" && (
          <div className="t-cap">
            審査中は編集できません。内容を直したい場合は「取り下げ」で記載中に戻してください。
          </div>
        )}
        {theme.status === "approved" && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-[12px] text-emerald-800 leading-relaxed">
            ✅ <strong>承認されました。</strong>
            まだ応募者には見えていません。準備が整ったら
            「🚀 公開する」ボタンを押してください。
            <br />
            <span className="opacity-80">
              修正したい場合は「📝 下書きに戻して修正」で編集 → 再申請できます。
            </span>
          </div>
        )}
      </GlassCard>

      {isPoster && isEditableStatus && !theme.is_demo && (
        <AiScoreCard scores={aiScores} scoring={aiScoring} />
      )}

      {theme.is_demo && (
        <div
          className="rounded-xl p-3 text-[12.5px] leading-relaxed"
          style={{
            background: "rgba(255,176,32,.12)",
            borderLeft: "4px solid var(--warn)",
          }}
        >
          📌 <strong>これは見本テーマです</strong>。編集はできません。一覧から
          「＋ 新規テーマ作成」で自分のテーマを作成してください。
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 共同編集者 / 閲覧者 (見本テーマと審査中以外で表示) */}
      {!theme.is_demo && !reviewerMode && (
        <ThemeCollaboratorsPanel
          themeId={theme.id}
          posterUserId={theme.posted_by}
          canManage={canManageCollaborators}
          initialCollaborators={collaborators}
          orgMembers={orgMembers}
        />
      )}

      {/* 本体: 左プレビュー / 右フォーム */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 lg:gap-5">
        <aside className="lg:sticky lg:top-[90px] lg:self-start lg:max-h-[calc(100vh-200px)] flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-2 px-1 gap-2 flex-wrap">
            <div className="t-label">👀 応募者にはこう見えます</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFullscreenPreview(true)}
                className="rounded-full bg-white border border-line px-2.5 py-0.5 text-[10.5px] font-bold text-mute hover:text-ink"
                title="プレビューを全画面で表示 (社内説明用)"
              >
                🖥 全画面で見る
              </button>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                style={{ background: statusMeta.color }}
              >
                {statusMeta.emo} {statusMeta.label}
              </span>
            </div>
          </div>
          <div className="overflow-y-auto">
            <ThemePublicView
              theme={theme}
              orgName={orgName}
              applyButton={{ kind: "preview" }}
              editableThumbnail={
                canEdit
                  ? {
                      uploading: uploadingThumb,
                      onPickFile: uploadThumbnail,
                      onCommitTransform: (next) =>
                        patch({
                          thumbnail_zoom: next.zoom,
                          thumbnail_offset_x: next.offsetX,
                          thumbnail_offset_y: next.offsetY,
                        }),
                      onClear: clearThumbnail,
                    }
                  : undefined
              }
            />
          </div>
        </aside>

        <div
          className={
            reviewerMode
              ? "lg:sticky lg:top-[90px] lg:self-start"
              : "flex flex-col gap-4"
          }
        >
          {reviewerMode ? (
            <ThemeReviewPanel
              theme={theme}
              initialDecisions={initialDecisions}
              currentUserId={currentUserId}
              orgAdmins={orgAdmins}
              onFinalized={(status) => {
                setTheme((prev) => ({ ...prev, status }));
                router.refresh();
              }}
            />
          ) : (
            <ThemeForm
              theme={theme}
              patch={patch}
              readOnly={!canEdit}
              reviewComments={showReviewNotes ? reviewComments : []}
              aiScores={aiScores}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** 出題者向け: AI 採点の平均点と項目別点数のサマリ。
 *  各項目の詳細コメントはフォーム内 (Field) で表示するため、ここでは
 *  項目名と点数だけを 2 列グリッドで圧縮表示する。 */
function AiScoreCard({
  scores,
  scoring,
}: {
  scores: ThemeAiScores | null;
  scoring: boolean;
}) {
  const failCount = themeItemsBelowThreshold(scores).length;
  const total = THEME_SCORE_ITEMS.length;
  const targetCount = scores
    ? THEME_SCORE_ITEMS.filter(
        (it) => (scores.items[it.key]?.score ?? 0) >= THEME_SCORE_TARGET,
      ).length
    : 0;
  const sumScore = scores
    ? THEME_SCORE_ITEMS.reduce(
        (s, it) => s + (scores.items[it.key]?.score ?? 0),
        0,
      )
    : 0;
  const avgScore = scores ? Math.round(sumScore / total) : 0;
  let headerBadge: { label: string; cls: string } | null = null;
  if (scores) {
    if (failCount > 0) {
      headerBadge = {
        label: `${failCount} 項目が ${THEME_SCORE_THRESHOLD} 点未満（申請不可）`,
        cls: "bg-warn",
      };
    } else if (targetCount === total) {
      headerBadge = {
        label: `🎯 全項目が目標水準（${THEME_SCORE_TARGET}点）達成`,
        cls: "bg-[--c-accent]",
      };
    } else {
      headerBadge = {
        label: `✓ 申請可能（${total - targetCount} 項目が ${THEME_SCORE_TARGET}点 目標に届かず）`,
        cls: "bg-mute",
      };
    }
  }
  const avgTier = themeScoreTier(avgScore);
  const avgCls =
    avgTier === "target"
      ? "text-[--c-accent-deep]"
      : avgTier === "min"
        ? "text-ink"
        : "text-warn";
  return (
    <GlassCard className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-[13.5px] font-bold">🤖 AI 採点</h3>
        {headerBadge && (
          <span
            className={
              "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold text-white " +
              headerBadge.cls
            }
          >
            {headerBadge.label}
          </span>
        )}
      </div>
      <p className="t-cap leading-relaxed">
        テキスト {total} 項目を AI が 0〜100 点（5点刻み）で採点します。
        全項目 <strong>{THEME_SCORE_THRESHOLD} 点以上で申請可能</strong>、
        <strong>{THEME_SCORE_TARGET} 点</strong>を目指しましょう。
        「📨 申請する」を押すと採点が走ります。
        各項目のAIコメントはフォーム内の入力欄上に表示されます。
      </p>

      {scoring && <div className="t-cap">🤖 採点中です...</div>}

      {scores && (
        <>
          {/* 平均点 */}
          <div className="flex items-baseline gap-2 rounded-md border border-line-soft bg-canvas-2/40 px-3 py-2">
            <span className="t-label">平均点</span>
            <span className={"text-[26px] font-extrabold leading-none " + avgCls}>
              {avgScore}
            </span>
            <span className="text-[11px] text-mute">/ 100</span>
            <span className="ml-auto t-cap">
              {total} 項目 ／ 達成 {targetCount} ／ 未達 {failCount}
            </span>
          </div>
          {/* 項目別 (2 列グリッド・点数のみ) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5">
            {THEME_SCORE_ITEMS.map((it) => {
              const item = scores.items[it.key];
              const score = item?.score ?? 0;
              const tier = themeScoreTier(score);
              const tierCls =
                tier === "target"
                  ? "bg-[--c-accent] text-white"
                  : tier === "min"
                    ? "bg-accent-soft text-[--c-accent-deep]"
                    : "bg-warn/20 text-warn";
              return (
                <div
                  key={it.key}
                  className="flex items-center justify-between gap-2 rounded-md border border-line-soft px-2.5 py-1"
                >
                  <span className="text-[11.5px] font-semibold truncate">
                    {it.label}
                  </span>
                  <span
                    className={
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold flex-shrink-0 " +
                      tierCls
                    }
                  >
                    {score}
                  </span>
                </div>
              );
            })}
          </div>
          {scores.summary && (
            <div className="rounded-md bg-mute/5 px-2.5 py-2 text-[12px] leading-relaxed">
              <span className="font-bold mr-1">総評:</span>
              {scores.summary}
            </div>
          )}
        </>
      )}
    </GlassCard>
  );
}

/** フォーム入力欄の上に表示する AI 採点ボックス (左=点数 / 右=コメント)。 */
function AiScoreBox({
  item,
}: {
  item?: { score: number; comment: string } | null;
}) {
  if (!item) return null;
  const tier = themeScoreTier(item.score);
  const tierCls =
    tier === "target"
      ? "bg-[--c-accent] text-white"
      : tier === "min"
        ? "bg-accent-soft text-[--c-accent-deep]"
        : "bg-warn/20 text-warn";
  const tierMark = tier === "target" ? "🎯" : tier === "min" ? "✓" : "↑";
  return (
    <div className="mt-1 mb-1 flex gap-2 items-stretch rounded-md border border-line-soft bg-canvas-2/40 p-1.5">
      <div
        className={
          "flex flex-col items-center justify-center rounded px-2 py-1 flex-shrink-0 min-w-[58px] " +
          tierCls
        }
      >
        <span className="text-[10px] leading-none mb-0.5">🤖 {tierMark}</span>
        <span className="text-[14px] font-extrabold leading-none">
          {item.score}
        </span>
      </div>
      {item.comment && (
        <p className="flex-1 text-[11.5px] leading-relaxed self-center">
          {item.comment}
        </p>
      )}
    </div>
  );
}

/** 差し戻しコメント (フォーム項目の横に表示する修正ガイド)。 */
function ReviewFieldNote({ comment }: { comment?: string | null }) {
  if (!comment) return null;
  return (
    <div
      className="mt-1 rounded-md px-2.5 py-1.5 text-[11.5px] leading-relaxed"
      style={{
        background: "rgba(245,158,11,.12)",
        borderLeft: "3px solid var(--warn)",
      }}
    >
      <span className="font-bold mr-1">↩ 差し戻し:</span>
      <span className="whitespace-pre-wrap">{comment}</span>
    </div>
  );
}

/** 右側の入力フォーム本体 */
function ThemeForm({
  theme,
  patch,
  readOnly,
  reviewComments = [],
  aiScores,
}: {
  theme: Theme;
  patch: (p: Partial<Theme>) => void;
  readOnly: boolean;
  /** 差し戻し時の項目別コメント (該当項目の横に表示) */
  reviewComments?: { item_key: string; comment: string | null }[];
  /** AI 採点結果 (各 Field の入力欄上に表示) */
  aiScores?: ThemeAiScores | null;
}) {
  const noteFor = (key: string) =>
    reviewComments.find((c) => c.item_key === key && c.comment)?.comment ?? null;
  const aiFor = (key: string) =>
    aiScores?.items[key as keyof typeof aiScores.items] ?? null;
  return (
    <GlassCard className="p-5">
      <fieldset disabled={readOnly} className="contents">
        <h3 className="t-h3 mb-3">
          <span aria-hidden className="mr-2">
            📝
          </span>
          基本情報
        </h3>

        <div className="grid grid-cols-[100px_1fr] gap-2 mb-4 items-center">
          <span className="t-label">コード</span>
          <input
            type="text"
            value={theme.code ?? ""}
            onChange={(e) => patch({ code: e.target.value || null })}
            className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent] t-mono disabled:bg-canvas-2 disabled:text-mute"
          />
          <span className="t-label">課題テーマタイトル</span>
          <input
            type="text"
            value={theme.title}
            onChange={(e) => patch({ title: e.target.value })}
            className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] font-semibold outline-none focus:border-[--c-accent] disabled:bg-canvas-2 disabled:text-mute"
          />
          {(noteFor("title") || aiFor("title")) && (
            <div className="col-span-2">
              <AiScoreBox item={aiFor("title")} />
              <ReviewFieldNote comment={noteFor("title")} />
            </div>
          )}
          <span className="t-label">主催企業</span>
          <input
            type="text"
            value={theme.company_name ?? ""}
            onChange={(e) => patch({ company_name: e.target.value || null })}
            className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent] disabled:bg-canvas-2 disabled:text-mute"
          />
          <span className="t-label">担当者</span>
          <input
            type="text"
            value={theme.contact_name ?? ""}
            onChange={(e) => patch({ contact_name: e.target.value || null })}
            className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent] disabled:bg-canvas-2 disabled:text-mute"
          />
          <span className="t-label">締切</span>
          <input
            type="date"
            value={theme.deadline ? theme.deadline.slice(0, 10) : ""}
            onChange={(e) =>
              patch({
                deadline: e.target.value
                  ? new Date(e.target.value).toISOString()
                  : null,
              })
            }
            className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent] disabled:bg-canvas-2 disabled:text-mute"
          />
          <span className="t-label">サムネ画像</span>
          <div className="text-[11.5px] text-mute leading-relaxed">
            左のプレビュー画像をクリックでアップロード。画像をドラッグすると枠内で位置調整、下のスライダーで拡縮できます。
          </div>
          {noteFor("image") && (
            <div className="col-span-2">
              <ReviewFieldNote comment={noteFor("image")} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <label className="block">
            <span className="t-label block mb-1">カテゴリ</span>
            <select
              value={theme.category ?? ""}
              onChange={(e) =>
                patch({ category: (e.target.value || null) as Theme["category"] })
              }
              className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent] disabled:bg-canvas-2 disabled:text-mute"
            >
              <option value="">未指定</option>
              <option value="new">新規</option>
              <option value="renewal">リニューアル</option>
            </select>
          </label>
          <label className="block">
            <span className="t-label block mb-1">実装レベル</span>
            <select
              value={theme.implementation_level ?? ""}
              onChange={(e) =>
                patch({
                  implementation_level: (e.target.value ||
                    null) as Theme["implementation_level"],
                })
              }
              className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent] disabled:bg-canvas-2 disabled:text-mute"
            >
              <option value="">未指定</option>
              <option value="poc">PoC 段階</option>
              <option value="impl">本格実装</option>
            </select>
          </label>
        </div>

        <div className="rounded-lg bg-accent-soft/50 p-3 mb-4">
          <div className="t-label mb-2">📋 NEO テーマ出題 3 基準</div>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={theme.criteria_region}
                onChange={(e) => patch({ criteria_region: e.target.checked })}
              />
              <span>① 地域のためのテーマであること</span>
            </label>
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={theme.criteria_means}
                onChange={(e) => patch({ criteria_means: e.target.checked })}
              />
              <span>② 既存サービスは「手段」であって「目的」ではない</span>
            </label>
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={theme.criteria_youth}
                onChange={(e) => patch({ criteria_youth: e.target.checked })}
              />
              <span>③ 若者が&quot;当事者&quot;として関われる余地があること</span>
            </label>
          </div>
          <ReviewFieldNote comment={noteFor("criteria")} />
        </div>

        <h3 className="t-h3 mb-3 mt-5">
          <span aria-hidden className="mr-2">
            🧭
          </span>
          テーマの中身
        </h3>

        <Field
          label="📝 課題テーマ概要"
          value={theme.description_long}
          onChange={(v) => patch({ description_long: v })}
          placeholder="このテーマで取り組みたいこと・解きたい問題を 2〜4 文の要約で。応募者が一目で「自分ごと化」できる短い概要。"
          note={noteFor("description_long")}
          aiItem={aiFor("description_long")}
        />
        <Field
          label="🌟 プロジェクトのビジョン（達成したい状態とその状態を表す目標数値）"
          value={theme.vision}
          onChange={(v) => patch({ vision: v })}
          placeholder="このテーマで目指す理想状態。5〜10年後にどんな景色を実現したいか。"
          note={noteFor("vision")}
          aiItem={aiFor("vision")}
        />
        <Field
          label="📍 現状"
          value={theme.current_state}
          onChange={(v) => patch({ current_state: v })}
          placeholder="ビジョンに対する現在の状態を「事実」で。数値・現場の声・行動データなど観察可能なもの。"
          note={noteFor("current_state")}
          aiItem={aiFor("current_state")}
        />
        <Field
          label="🔥 問題（ビジョンと現状のギャップ）"
          value={theme.pain}
          onChange={(v) => patch({ pain: v })}
          placeholder="ビジョンと現状の差分。事実として何が起きていないか。憶測ではなく事実で。"
          note={noteFor("pain")}
          aiItem={aiFor("pain")}
        />
        <Field
          label="🧬 問題が起きている要因"
          value={theme.root_cause}
          onChange={(v) => patch({ root_cause: v })}
          placeholder="なぜその問題が起きているか。構造・制度・行動・文化など複数の観点で要因を分析。"
          note={noteFor("root_cause")}
          aiItem={aiFor("root_cause")}
        />
        <Field
          label="⛳ 取り組むべき課題"
          value={theme.focus_issue}
          onChange={(v) => patch({ focus_issue: v })}
          placeholder="要因分析を踏まえ、このプロジェクトで取り組む「焦点」。全部ではなく絞る。"
          note={noteFor("focus_issue")}
          aiItem={aiFor("focus_issue")}
        />
        <Field
          label="💡 WHY (なぜやるのか? = 背景)"
          value={theme.background}
          onChange={(v) => patch({ background: v })}
          placeholder="このテーマが必要になった社会背景・経緯。なぜ「今」取り組むのか。"
          note={noteFor("background")}
          aiItem={aiFor("background")}
        />
        <Field
          label="🧑‍🤝‍🧑 WHO (ターゲット)"
          value={theme.who_target}
          onChange={(v) => patch({ who_target: v })}
          placeholder="誰の何を解決したいか。年齢 / 属性 / 状況の具体像。"
          note={noteFor("who_target")}
          aiItem={aiFor("who_target")}
        />
        <Field
          label="💎 WHAT (提供価値)"
          value={theme.what_benefit}
          onChange={(v) => patch({ what_benefit: v })}
          placeholder="相手にとって何が良くなるか。プロダクト名ではなく相手が得る変化。"
          note={noteFor("what_benefit")}
          aiItem={aiFor("what_benefit")}
        />
        <Field
          label="🌱 期待される成果"
          value={theme.expected_outcome}
          onChange={(v) => patch({ expected_outcome: v })}
          placeholder="プロジェクトを通じて生まれる地域や人への変化。"
          note={noteFor("expected_outcome")}
          aiItem={aiFor("expected_outcome")}
        />
        <Field
          label="✨ 独自性"
          value={theme.what_uniqueness}
          onChange={(v) => patch({ what_uniqueness: v })}
          placeholder="このテーマならではの新しさ。なぜこの組織が出す意味があるのか。"
          note={noteFor("what_uniqueness")}
          aiItem={aiFor("what_uniqueness")}
        />
        <Field
          label="🪤 実装する上でのリスク"
          value={theme.internal_challenges}
          onChange={(v) => patch({ internal_challenges: v })}
          placeholder="現状の業務やリソースで足りていないこと / 起こりうる障害 / 社内の壁。"
          note={noteFor("internal_challenges")}
          aiItem={aiFor("internal_challenges")}
        />
        <BulletListField
          label="🤝 提供できるリソース"
          hint="採択チームに提供できるリソースを箇条書きで。例: 資金 500 万円、工場の製造設備、専門家の月 4 時間メンタリング、データセットなど。応募者の意思決定の決め手になる重要項目。"
          value={theme.prize}
          legacyOther={theme.resource_other}
          onChange={(v) => patch({ prize: v })}
          note={noteFor("resources")}
          aiItem={aiFor("resources")}
        />
        <Field
          label="🚀 採択後のアクション"
          value={theme.post_action}
          onChange={(v) => patch({ post_action: v })}
          placeholder="採用された場合の次のステップ。実証実験 / 共同開発 / 採用 / etc."
          note={noteFor("post_action")}
          aiItem={aiFor("post_action")}
        />
      </fieldset>
    </GlassCard>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  note,
  aiItem,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  note?: string | null;
  aiItem?: { score: number; comment: string } | null;
}) {
  return (
    <label className="block mb-3">
      <span className="t-label block mb-1">{label}</span>
      <textarea
        rows={3}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder={placeholder}
        className="w-full rounded-md border border-line bg-white px-2.5 py-2 text-[12px] outline-none focus:border-[--c-accent] resize-none leading-relaxed disabled:bg-canvas-2 disabled:text-mute"
      />
      <AiScoreBox item={aiItem} />
      <ReviewFieldNote comment={note} />
    </label>
  );
}

/** リソースを 1 行 = 1 アイテムで保存する箇条書きエディタ。 */
function BulletListField({
  label,
  hint,
  value,
  legacyOther,
  onChange,
  note,
  aiItem,
}: {
  label: string;
  hint?: string;
  value: string | null;
  legacyOther: string | null;
  onChange: (v: string | null) => void;
  note?: string | null;
  aiItem?: { score: number; comment: string } | null;
}) {
  const merged = [value, legacyOther]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join("\n");
  const parseLines = (src: string): string[] =>
    src
      ? src
          .split(/\r?\n/)
          .map((s) => s.replace(/^[・•\-\s]+/, "").trim())
          .filter(Boolean)
      : [];

  // 表示用ローカル state: 「+ 行を追加」直後の末尾の空行を保持するため
  // props から derive せずローカルで持つ。
  const [items, setItems] = useState<string[]>(() => {
    const lines = parseLines(merged);
    return lines.length > 0 ? lines : [""];
  });
  // 自分が直近 onChange に渡した値。親 props がこれと同じならローカル state を維持する
  // (= 自分の commit による親更新では再同期しない、末尾の空行を消さない)。
  const lastCommittedRef = useRef<string>(parseLines(merged).join("\n"));

  useEffect(() => {
    if (merged !== lastCommittedRef.current) {
      const lines = parseLines(merged);
      setItems(lines.length > 0 ? lines : [""]);
      lastCommittedRef.current = lines.join("\n");
    }
  }, [merged]);

  const commit = (next: string[]) => {
    setItems(next);
    const cleaned = next.map((s) => s.trim()).filter(Boolean).join("\n");
    lastCommittedRef.current = cleaned;
    onChange(cleaned.length > 0 ? cleaned : null);
  };

  return (
    <div className="mb-3">
      <span className="t-label block mb-1">{label}</span>
      {hint && <p className="t-cap mb-2 leading-relaxed opacity-80">{hint}</p>}
      <ul className="flex flex-col gap-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className="inline-block w-5 text-center text-[12px] text-mute flex-shrink-0"
              aria-hidden
            >
              •
            </span>
            <input
              type="text"
              value={it}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                commit(next);
              }}
              placeholder={
                i === 0
                  ? "例: 資金 500 万円 (採択時に支払い)"
                  : i === 1
                    ? "例: 工場 B 棟の製造設備の利用権 (週 2 日)"
                    : "リソースを追加..."
              }
              className="flex-1 rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent] disabled:bg-canvas-2 disabled:text-mute"
            />
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const next = items.filter((_, j) => j !== i);
                  commit(next.length > 0 ? next : [""]);
                }}
                aria-label="この項目を削除"
                className="grid h-7 w-7 place-items-center rounded-md text-mute hover:text-error hover:bg-red-50 flex-shrink-0"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => commit([...items, ""])}
        className="mt-2 rounded-full bg-white border border-line px-3 py-1 text-[11px] font-semibold text-mute hover:text-ink"
      >
        ＋ 行を追加
      </button>
      <AiScoreBox item={aiItem} />
      <ReviewFieldNote comment={note} />
    </div>
  );
}

/** 応募者プレビューを全画面で表示するモーダル。
 *  社内説明・打合せ画面共有用。編集はできない、見るだけ。 */
function ThemeFullscreenPreview({
  open,
  onClose,
  theme,
  orgName,
}: {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  orgName: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [previewWide, setPreviewWide] = useState(true);
  // フォントサイズ倍率 (1.0 / 1.25 / 1.5 / 1.75) — 初期値はやや大きめ
  const [previewScale, setPreviewScale] = useState(1.25);
  const rootRef = useRef<HTMLDivElement>(null);
  // 印刷中は fullscreenchange の onClose を抑止する
  const printingRef = useRef(false);
  useEffect(() => setMounted(true), []);

  const cycleScale = () => {
    setPreviewScale((s) =>
      s >= 1.75 ? 1.0 : s >= 1.5 ? 1.75 : s >= 1.25 ? 1.5 : 1.25,
    );
  };

  // 印刷 / PDF 保存
  // fullscreen 中は Chrome が印刷ダイアログを開けない場合があるので、
  // 先に fullscreen を抜けてから window.print() を呼ぶ。
  // printingRef を立てて fullscreenchange の onClose を抑止する。
  const handlePrint = async () => {
    try {
      if (document.fullscreenElement) {
        printingRef.current = true;
        await document.exitFullscreen?.().catch(() => {});
        // fullscreen 解除の描画反映を待つ
        await new Promise((r) => setTimeout(r, 200));
      }
    } catch {
      // ignore
    }
    try {
      window.print();
    } finally {
      // 印刷ダイアログ処理後にフラグを解除
      setTimeout(() => {
        printingRef.current = false;
      }, 500);
    }
  };

  // ESC で閉じる + 開いてる間は背面スクロールロック
  // + ブラウザ Fullscreen API を使って本当に全画面化
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // ブラウザの fullscreen を要求 (ユーザ操作起因なので原則許可される)
    const el = rootRef.current ?? document.documentElement;
    const req = (
      el as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
        msRequestFullscreen?: () => Promise<void> | void;
      }
    ).requestFullscreen
      ?.call(el)
      ?.catch(() => {
        // 拒否されてもオーバーレイは出るのでサイレントに無視
      });
    void req;

    // ユーザが F11 / ESC でブラウザ fullscreen を抜けた時、モーダルも閉じる
    // ただし印刷のために自分で exitFullscreen した時は onClose しない
    const onFsChange = () => {
      if (!document.fullscreenElement && !printingRef.current) onClose();
    };
    document.addEventListener("fullscreenchange", onFsChange);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFsChange);
      document.body.style.overflow = prevOverflow;
      if (document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => {});
      }
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;
  return createPortal(
    <div
      ref={rootRef}
      className="fixed inset-0 z-[120] flex flex-col theme-fullscreen-preview"
      style={{
        background:
          "linear-gradient(180deg, var(--c-bg-1) 0%, var(--c-bg-2) 100%)",
      }}
    >
      {/* 印刷用 CSS: プレビューだけ紙に載る形にリセット */}
      <style
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `
@media print {
  /* デフォルトは全非表示にして、プレビューモーダルだけ見せる */
  body > *:not(.theme-fullscreen-preview) { display: none !important; }
  html, body { background: white !important; }
  .theme-fullscreen-preview {
    position: static !important;
    display: block !important;
    background: white !important;
    overflow: visible !important;
    color: black !important;
  }
  .theme-fullscreen-preview-toolbar { display: none !important; }
  .theme-fullscreen-preview-body {
    overflow: visible !important;
    padding: 0 !important;
    zoom: 1 !important;
  }
  .theme-fullscreen-preview-inner {
    max-width: 100% !important;
    zoom: 1 !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  /* ページ余白と改ページ制御 */
  @page { margin: 12mm; size: A4; }
  h1, h2, h3 { page-break-after: avoid; break-after: avoid; }
  img { max-width: 100% !important; page-break-inside: avoid; break-inside: avoid; }
  /* インタラクティブ要素は印刷時 no-op に */
  button, a[role="button"] { pointer-events: none; }
}
          `,
        }}
      />
      {/* 上部ツールバー (閉じるボタン + 幅切替 + 案内) — 暗バーで内容と分離 */}
      <div
        className="flex items-center justify-between px-4 md:px-6 py-3 border-b text-white shadow-sm theme-fullscreen-preview-toolbar"
        style={{ background: "var(--ink)", borderColor: "rgba(0,0,0,0.15)" }}
      >
        <div className="flex items-center gap-3">
          <span aria-hidden className="text-[18px]">
            🖥
          </span>
          <div>
            <div className="text-[14px] font-bold">プレビュー (全画面)</div>
            <div className="text-[11.5px] opacity-70 leading-tight">
              応募者にはこう見えます ・ 社内説明用
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cycleScale}
            className="rounded-full bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 text-[11.5px] font-bold border border-white/30"
            title="文字サイズ切替 (1.0× / 1.25× / 1.5× / 1.75× を順に)"
          >
            🔍 文字サイズ {previewScale.toFixed(2).replace(/\.?0+$/, "")}×
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-full bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 text-[11.5px] font-bold border border-white/30"
            title="ブラウザの印刷ダイアログを開きます。「送信先: PDF に保存」で PDF 化できます"
          >
            🖨 PDFで印刷
          </button>
          <button
            type="button"
            onClick={() => setPreviewWide((v) => !v)}
            className="rounded-full bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 text-[11.5px] font-bold border border-white/30"
            title={previewWide ? "中央寄せ (読みやすい幅)" : "画面いっぱい"}
          >
            {previewWide ? "📱 読みやすい幅" : "🖥 画面いっぱい"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 hover:bg-white/20 text-white px-4 py-1.5 text-[12.5px] font-bold border border-white/30"
            title="閉じる (ESC)"
          >
            ✕ 閉じる (ESC)
          </button>
        </div>
      </div>

      {/* 本体: 画面いっぱい / 読みやすい幅 切替 + 文字サイズ拡大 (zoom) */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-10 theme-fullscreen-preview-body">
        <div
          className="mx-auto w-full theme-fullscreen-preview-inner"
          style={{
            maxWidth: previewWide ? "100%" : 820,
            // `zoom` で文字 + 余白を一括拡大。zoom は Chrome/Edge/Safari/
            // 最新 Firefox で動作。スクロール幅も自動調整される。
            zoom: previewScale,
          }}
        >
          <ThemePublicView
            theme={theme}
            orgName={orgName}
            applyButton={{ kind: "preview" }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
