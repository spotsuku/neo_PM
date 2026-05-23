"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { ThemePublicView } from "@/components/themes/ThemePublicView";
import { themeStatusMeta } from "@/lib/themeStatus";
import type { Database } from "@/lib/types/database";

type Theme = Database["public"]["Tables"]["themes"]["Row"];

interface Props {
  orgSlug: string;
  orgId: string;
  orgName: string;
  initialTheme: Theme;
  currentUserId: string;
  canManageAll: boolean;
  currentProjectId?: string | null;
}

export function ThemeStudio({
  orgSlug,
  orgName,
  initialTheme,
  currentUserId,
  canManageAll,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // 親 props が ?t= 切替で変わったら同期
  const lastIdRef = useRef(initialTheme.id);
  useEffect(() => {
    if (initialTheme.id !== lastIdRef.current) {
      setTheme(initialTheme);
      lastIdRef.current = initialTheme.id;
    }
  }, [initialTheme]);

  useEffect(() => () => timersRef.current.forEach((t) => clearTimeout(t)), []);

  const isPoster = theme.posted_by === currentUserId;
  const isEditableStatus =
    theme.status === "draft" || theme.status === "changes_requested";
  const canEdit = (isPoster || canManageAll) && isEditableStatus && !theme.is_demo;
  const statusMeta = themeStatusMeta(theme.status);

  // デバウンス自動保存 (編集可能時のみ)
  const patch = (p: Partial<Theme>) => {
    if (!canEdit) return;
    setTheme((prev) => ({ ...prev, ...p }));
    const tkey = `${theme.id}:${Object.keys(p).join(",")}`;
    const existing = timersRef.current.get(tkey);
    if (existing) clearTimeout(existing);
    setSavingFields((prev) => new Set(prev).add(tkey));
    const tm = setTimeout(async () => {
      const { error: err } = await supabase
        .from("themes")
        .update(p as never)
        .eq("id", theme.id);
      setSavingFields((prev) => {
        const next = new Set(prev);
        next.delete(tkey);
        return next;
      });
      setError(err ? err.message : null);
    }, 600);
    timersRef.current.set(tkey, tm);
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

  const submit = () => {
    if (!theme.title.trim()) {
      setError("タイトルを入力してから申請してください。");
      return;
    }
    if (
      !window.confirm(
        "このテーマを申請します。申請後は審査が終わるまで編集できません。よろしいですか？",
      )
    )
      return;
    applyNow({ status: "submitted", submitted_at: new Date().toISOString() });
  };

  const withdraw = () => {
    if (!window.confirm("申請を取り下げて記載中に戻します。よろしいですか？"))
      return;
    applyNow({ status: "draft" });
  };

  const approve = () => {
    if (!window.confirm("承認して応募一覧に公開します。よろしいですか？")) return;
    applyNow({
      status: "active",
      reviewed_at: new Date().toISOString(),
      reviewed_by: currentUserId,
    });
  };

  const requestChanges = () => {
    const note = window.prompt(
      "差し戻しの理由・修正してほしい点を記入してください（応募者には表示されません。出題者に伝わります）。",
    );
    if (note === null) return;
    if (!note.trim()) {
      setError("差し戻しにはコメントが必要です。");
      return;
    }
    applyNow({
      status: "changes_requested",
      review_note: note.trim(),
      reviewed_at: new Date().toISOString(),
      reviewed_by: currentUserId,
    });
  };

  const setActiveStatus = (status: Theme["status"], confirmMsg: string) => {
    if (!window.confirm(confirmMsg)) return;
    applyNow({ status });
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
          <Link
            href={`/${orgSlug}/themes/applications`}
            className="rounded-full bg-white px-4 py-1.5 text-[11.5px] font-semibold text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)]"
          >
            📋 応募の管理 →
          </Link>
        </div>
      </GlassCard>

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
                disabled={busy}
                className="rounded-full bg-ink px-5 py-2 text-[12px] font-bold text-white hover:opacity-90 disabled:opacity-50"
              >
                📨 申請する
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
            {/* 管理者: 審査 */}
            {canManageAll && theme.status === "submitted" && (
              <>
                <button
                  type="button"
                  onClick={requestChanges}
                  disabled={busy}
                  className="rounded-full bg-white border border-line px-4 py-2 text-[12px] font-semibold text-error hover:bg-red-50 disabled:opacity-50"
                >
                  ↩️ 差し戻し
                </button>
                <button
                  type="button"
                  onClick={approve}
                  disabled={busy}
                  className="rounded-full bg-ink px-5 py-2 text-[12px] font-bold text-white hover:opacity-90 disabled:opacity-50"
                >
                  ✓ 承認して公開
                </button>
              </>
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

        {/* 差し戻しコメント */}
        {theme.status === "changes_requested" && theme.review_note && (
          <div
            className="rounded-lg p-3 text-[12.5px] leading-relaxed"
            style={{
              background: "rgba(255,84,104,.08)",
              borderLeft: "4px solid var(--error, #ff5468)",
            }}
          >
            <strong>↩️ 差し戻しコメント</strong>
            <div className="mt-1 whitespace-pre-wrap">{theme.review_note}</div>
          </div>
        )}
        {theme.status === "submitted" && (
          <div className="t-cap">
            審査中は編集できません。内容を直したい場合は「取り下げ」で記載中に戻してください。
          </div>
        )}
      </GlassCard>

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

      {/* 本体: 左プレビュー / 右フォーム */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 lg:gap-5">
        <aside className="lg:sticky lg:top-[90px] lg:self-start lg:max-h-[calc(100vh-200px)] flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="t-label">👀 応募者にはこう見えます</div>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
              style={{ background: statusMeta.color }}
            >
              {statusMeta.emo} {statusMeta.label}
            </span>
          </div>
          <div className="overflow-y-auto">
            <ThemePublicView
              theme={theme}
              orgName={orgName}
              applyButton={{ kind: "preview" }}
            />
          </div>
        </aside>

        <div className="flex flex-col gap-4">
          <ThemeForm theme={theme} patch={patch} readOnly={!canEdit} />
        </div>
      </div>
    </div>
  );
}

/** 右側の入力フォーム本体 */
function ThemeForm({
  theme,
  patch,
  readOnly,
}: {
  theme: Theme;
  patch: (p: Partial<Theme>) => void;
  readOnly: boolean;
}) {
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
          <span className="t-label">サムネ画像 URL</span>
          <input
            type="url"
            value={theme.thumbnail_url ?? ""}
            onChange={(e) => patch({ thumbnail_url: e.target.value || null })}
            placeholder="https://images.example.com/cover.jpg"
            className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent] t-mono disabled:bg-canvas-2 disabled:text-mute"
          />
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
        />
        <Field
          label="💡 WHY (なぜやるのか? = 背景)"
          value={theme.background}
          onChange={(v) => patch({ background: v })}
          placeholder="このテーマが必要になった社会背景・経緯。なぜ「今」取り組むのか。"
        />
        <Field
          label="🧑‍🤝‍🧑 WHO (ターゲット)"
          value={theme.who_target}
          onChange={(v) => patch({ who_target: v })}
          placeholder="誰の何を解決したいか。年齢 / 属性 / 状況の具体像。"
        />
        <Field
          label="🔥 問題"
          value={theme.pain}
          onChange={(v) => patch({ pain: v })}
          placeholder="既存のやり方では解決できていないこと。Pain ポイント。"
        />
        <Field
          label="💎 WHAT (提供価値)"
          value={theme.what_benefit}
          onChange={(v) => patch({ what_benefit: v })}
          placeholder="相手にとって何が良くなるか。プロダクト名ではなく相手が得る変化。"
        />
        <Field
          label="🌱 期待される成果"
          value={theme.expected_outcome}
          onChange={(v) => patch({ expected_outcome: v })}
          placeholder="プロジェクトを通じて生まれる地域や人への変化。"
        />
        <Field
          label="✨ 独自性"
          value={theme.what_uniqueness}
          onChange={(v) => patch({ what_uniqueness: v })}
          placeholder="このテーマならではの新しさ。なぜこの組織が出す意味があるのか。"
        />
        <Field
          label="🪤 実装する上でのリスク"
          value={theme.internal_challenges}
          onChange={(v) => patch({ internal_challenges: v })}
          placeholder="現状の業務やリソースで足りていないこと / 起こりうる障害 / 社内の壁。"
        />
        <BulletListField
          label="🤝 提供できるリソース"
          hint="採択チームに提供できるリソースを箇条書きで。例: 資金 500 万円、工場の製造設備、専門家の月 4 時間メンタリング、データセットなど。応募者の意思決定の決め手になる重要項目。"
          value={theme.prize}
          legacyOther={theme.resource_other}
          onChange={(v) => patch({ prize: v })}
        />
        <Field
          label="🚀 採択後のアクション"
          value={theme.post_action}
          onChange={(v) => patch({ post_action: v })}
          placeholder="採用された場合の次のステップ。実証実験 / 共同開発 / 採用 / etc."
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
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
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
}: {
  label: string;
  hint?: string;
  value: string | null;
  legacyOther: string | null;
  onChange: (v: string | null) => void;
}) {
  const merged = [value, legacyOther]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join("\n");
  const lines = merged
    ? merged.split(/\r?\n/).map((s) => s.replace(/^[・•\-\s]+/, "").trim())
    : [];
  const items = lines.length > 0 ? lines : [""];

  const commit = (next: string[]) => {
    const cleaned = next.map((s) => s.trim()).filter(Boolean);
    onChange(cleaned.length > 0 ? cleaned.join("\n") : null);
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
    </div>
  );
}
