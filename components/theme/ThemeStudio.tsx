"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { ThemePublicView } from "@/components/themes/ThemePublicView";
import type { Database } from "@/lib/types/database";

type Theme = Database["public"]["Tables"]["themes"]["Row"];

const STATUSES: {
  key: Theme["status"];
  label: string;
  emo: string;
  color: string;
}[] = [
  { key: "draft", label: "下書き", emo: "📝", color: "var(--mute)" },
  { key: "active", label: "公開中", emo: "🟢", color: "var(--ok)" },
  { key: "closed", label: "終了", emo: "📦", color: "var(--warn)" },
  { key: "archived", label: "アーカイブ", emo: "🗄", color: "var(--mute-2)" },
];

interface ThemeListItem {
  id: string;
  title: string;
  code: string | null;
  status: Theme["status"];
  is_demo: boolean;
  posted_by: string | null;
}

interface Props {
  orgSlug: string;
  orgId: string;
  orgName: string;
  initialTheme: Theme | null;
  themeList: ThemeListItem[];
  currentUserId: string;
  canManageAll: boolean;
  currentProjectId?: string | null;
  currentProjectName?: string | null;
}

export function ThemeStudio({
  orgSlug,
  orgId,
  orgName,
  initialTheme,
  themeList: initialList,
  currentUserId,
  canManageAll,
  currentProjectId = null,
  currentProjectName = null,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [theme, setTheme] = useState<Theme | null>(initialTheme);
  const [themeList, setThemeList] = useState<ThemeListItem[]>(initialList);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());

  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // デバウンス自動保存
  const patch = (p: Partial<Theme>) => {
    if (!theme) return;
    const themeId = theme.id;
    setTheme((prev) => (prev ? { ...prev, ...p } : prev));
    // ドロップダウン側 (themeList) も同期。テーマ切替後に元のテーマへ戻った時、
    // ローカル変更が "新しいテーマ" に戻って見えるのを防ぐ。
    setThemeList((prev) =>
      prev.map((t) =>
        t.id === themeId
          ? {
              ...t,
              ...(p.title !== undefined ? { title: p.title as string } : {}),
              ...(p.code !== undefined ? { code: p.code as string | null } : {}),
              ...(p.status !== undefined
                ? { status: p.status as ThemeListItem["status"] }
                : {}),
            }
          : t,
      ),
    );
    // タイマーキーは themeId + フィールド名で分離する。
    // 旧実装は "title" だけだったため、A の編集中に B に切り替えて B の title を
    // 編集すると A の保存タイマーが clearTimeout で消されて A の編集が失われていた。
    const fieldKey = Object.keys(p).join(",");
    const tkey = `${themeId}:${fieldKey}`;
    const existing = timersRef.current.get(tkey);
    if (existing) clearTimeout(existing);
    setSavingFields((prev) => new Set(prev).add(tkey));
    const tm = setTimeout(async () => {
      const { error: err } = await supabase
        .from("themes")
        .update(p as never)
        .eq("id", themeId);
      setSavingFields((prev) => {
        const next = new Set(prev);
        next.delete(tkey);
        return next;
      });
      if (err) setError(err.message);
      else setError(null);
    }, 600);
    timersRef.current.set(tkey, tm);
  };

  useEffect(
    () => () => timersRef.current.forEach((t) => clearTimeout(t)),
    [],
  );

  // 親 server component から渡される initialTheme が ?t= で切り替わった時、
  // useState(initialTheme) は再初期化されないため、ローカル state を同期する。
  // (createNew は楽観更新で先に setTheme(data) しているので id 一致 → no-op)
  const lastInitialIdRef = useRef<string | null>(initialTheme?.id ?? null);
  useEffect(() => {
    const newId = initialTheme?.id ?? null;
    if (newId !== lastInitialIdRef.current) {
      setTheme(initialTheme);
      lastInitialIdRef.current = newId;
    }
  }, [initialTheme]);

  const statusMeta = theme
    ? STATUSES.find((s) => s.key === theme.status) ?? STATUSES[0]
    : STATUSES[0];
  const anySaving = savingFields.size > 0;

  // テーマ画面のリストに表示する集合: 編集中のテーマも併合 (sync 用)
  const mergedList = useMemo(() => {
    const map = new Map(themeList.map((t) => [t.id, t]));
    if (theme) {
      map.set(theme.id, {
        id: theme.id,
        title: theme.title,
        code: theme.code,
        status: theme.status,
        is_demo: theme.is_demo,
        posted_by: theme.posted_by,
      });
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.is_demo !== b.is_demo) return a.is_demo ? 1 : -1;
      return a.title.localeCompare(b.title);
    });
  }, [themeList, theme]);

  const canDelete = Boolean(
    theme &&
      (canManageAll || theme.posted_by === currentUserId) &&
      !theme.is_demo,
  );

  const switchTo = (id: string) => {
    if (theme && id === theme.id) return;
    const q = new URLSearchParams();
    q.set("t", id);
    if (currentProjectId) q.set("p", currentProjectId);
    router.push(`/${orgSlug}/theme?${q.toString()}`);
  };

  const createNew = async (opts?: { linkToProject?: boolean }) => {
    if (creating) return;
    setCreating(true);
    setError(null);
    const baseTitle = opts?.linkToProject && currentProjectName
      ? `${currentProjectName} のテーマ`
      : "新しいテーマ";
    const { data, error: err } = await supabase
      .from("themes")
      .insert({
        organization_id: orgId,
        title: baseTitle,
        code: `NEO-${String(mergedList.length + 1).padStart(3, "0")}`,
        status: "draft",
        posted_by: currentUserId,
      })
      .select()
      .single();
    if (err || !data) {
      setCreating(false);
      setError(err?.message ?? "作成に失敗しました");
      return;
    }
    // 現在プロジェクトに紐付け (linkToProject=true の時)
    if (opts?.linkToProject && currentProjectId) {
      const { error: linkErr } = await supabase
        .from("projects")
        .update({ theme_id: data.id })
        .eq("id", currentProjectId);
      if (linkErr) {
        setError(`テーマは作成しましたが PJT への紐付けに失敗: ${linkErr.message}`);
      }
    }
    // 楽観更新: useState(initial) は再マウントしないと新 props を拾わないため、
    // ローカル state に直接反映して即時表示する
    setTheme(data as Theme);
    setThemeList((prev) => [
      ...prev.filter((t) => t.id !== data.id),
      {
        id: data.id,
        title: data.title,
        code: data.code,
        status: data.status,
        is_demo: data.is_demo,
        posted_by: data.posted_by,
      },
    ]);
    // URL を ?t=新ID に揃える (refresh は不要 — ローカル state で表示済み、
    // 後続の編集は patch() が DB に書き戻す)
    const q = new URLSearchParams();
    q.set("t", data.id);
    if (currentProjectId) q.set("p", currentProjectId);
    router.replace(`/${orgSlug}/theme?${q.toString()}`);
    setCreating(false);
  };

  const deleteCurrent = async () => {
    if (!canDelete || !theme) return;
    const phrase = `${theme.title} を削除`;
    const input = window.prompt(
      `テーマ「${theme.title}」を削除します。\n\n` +
        "応募・採択結果も含めて関連データが消えます。元に戻せません。\n\n" +
        `続行するには「${phrase}」と入力してください。`,
    );
    if (input !== phrase) {
      if (input !== null) {
        alert("入力が一致しませんでした。削除を中止しました。");
      }
      return;
    }
    const themeId = theme.id;
    const { error: err } = await supabase
      .from("themes")
      .delete()
      .eq("id", themeId);
    if (err) {
      setError(`削除に失敗しました: ${err.message}`);
      return;
    }
    setThemeList((prev) => prev.filter((t) => t.id !== themeId));
    // 別テーマに切替 (見本以外の最初 → 何でも最初 → /theme トップ)
    const next =
      mergedList.find((t) => t.id !== themeId && !t.is_demo) ??
      mergedList.find((t) => t.id !== themeId);
    const q = new URLSearchParams();
    if (next) q.set("t", next.id);
    if (currentProjectId) q.set("p", currentProjectId);
    router.push(
      `/${orgSlug}/theme${q.toString() ? `?${q.toString()}` : ""}`,
    );
    router.refresh();
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
            📣
          </span>
          <div className="min-w-0">
            <h1 className="text-[18px] font-extrabold tracking-tight">
              テーマ出題
            </h1>
            <div className="t-cap truncate">
              {orgName} ・ 応募者にどう見えるかを左で確認しながら、右で記入
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* テーマ切替プルダウン */}
          {theme && mergedList.length > 1 && (
            <select
              value={theme.id}
              onChange={(e) => switchTo(e.target.value)}
              className="rounded-full bg-white border border-line px-3 py-1.5 text-[11.5px] font-semibold text-ink hover:bg-mute/5"
              title="編集するテーマを切替"
            >
              {mergedList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.is_demo ? "📌 " : ""}
                  {t.code ? `${t.code} · ` : ""}
                  {t.title}
                  {t.status === "draft" ? " (下書き)" : ""}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => createNew()}
            disabled={creating}
            className="rounded-full bg-white border border-line px-3 py-1.5 text-[11.5px] font-semibold text-mute hover:text-ink disabled:opacity-50"
            title="新しいテーマを作成"
          >
            ＋ 新規
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={deleteCurrent}
              className="rounded-full bg-white border border-line px-3 py-1.5 text-[11.5px] font-semibold text-mute hover:text-error hover:bg-red-50"
              title="このテーマを削除"
            >
              🗑 削除
            </button>
          )}
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
          <Link
            href={`/${orgSlug}/themes/applications`}
            className="rounded-full bg-white px-4 py-1.5 text-[11.5px] font-semibold text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)]"
          >
            📋 応募の管理 →
          </Link>
        </div>
      </GlassCard>

      {theme?.is_demo && (
        <div
          className="rounded-xl p-3 text-[12.5px] leading-relaxed"
          style={{
            background: "rgba(255,176,32,.12)",
            borderLeft: "4px solid var(--warn)",
          }}
        >
          📌 <strong>これは見本テーマです</strong>。実際の出題ではありません。
          「＋ 新規」で自分のテーマを作って差し替えてください。
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!theme ? (
        <GlassCard className="p-10 grid place-items-center text-center">
          <div className="max-w-lg">
            <div className="text-5xl mb-3">📭</div>
            <h2 className="t-h2 mb-2">
              {currentProjectName
                ? `「${currentProjectName}」にはまだテーマがありません`
                : "出題テーマがまだありません"}
            </h2>
            <p className="t-cap mb-5 leading-relaxed">
              {currentProjectId && currentProjectName
                ? "このプロジェクトに紐付くテーマを新規作成しましょう。応募者には公開ステータスにしたタイミングで表示されます。"
                : "テーマを新しく作って応募者に出題しましょう。"}
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {currentProjectId && (
                <button
                  type="button"
                  onClick={() => createNew({ linkToProject: true })}
                  disabled={creating}
                  className="rounded-full bg-ink px-5 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {creating ? "作成中…" : "＋ このプロジェクトにテーマを作成"}
                </button>
              )}
              <button
                type="button"
                onClick={() => createNew()}
                disabled={creating}
                className="rounded-full bg-white border border-line px-5 py-2 text-[12.5px] font-semibold text-mute hover:text-ink disabled:opacity-50"
              >
                ＋ 新しいテーマだけ作成
              </button>
            </div>
          </div>
        </GlassCard>
      ) : (
        // 本体: 左プレビュー (sticky) / 右フォーム (page スクロール)
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 lg:gap-5">
          {/* 左: 応募者プレビュー */}
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

          {/* 右: フォーム (page スクロール) */}
          <div className="flex flex-col gap-4">
            <ThemeForm theme={theme} patch={patch} />
          </div>
        </div>
      )}
    </div>
  );
}

/** 右側の入力フォーム本体 */
function ThemeForm({
  theme,
  patch,
}: {
  theme: Theme;
  patch: (p: Partial<Theme>) => void;
}) {
  return (
    <GlassCard className="p-5">
      {/* ステータス手動切替 */}
      <div className="mb-4">
        <div className="t-label mb-2">📤 公開ステータス</div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => patch({ status: s.key })}
              className={
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition " +
                (theme.status === s.key
                  ? "bg-ink text-white"
                  : "bg-white text-mute hover:bg-mute/5 border border-line-soft")
              }
            >
              <span aria-hidden>{s.emo}</span>
              {s.label}
            </button>
          ))}
        </div>
        <p className="t-cap mt-1.5">
          下書きの間は応募者には表示されません。「公開中」にすると一覧に出ます。
        </p>
      </div>

      <hr className="border-line-soft mb-4" />

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
          className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent] t-mono"
        />
        <span className="t-label">課題テーマタイトル</span>
        <input
          type="text"
          value={theme.title}
          onChange={(e) => patch({ title: e.target.value })}
          className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] font-semibold outline-none focus:border-[--c-accent]"
        />
        <span className="t-label">主催企業</span>
        <input
          type="text"
          value={theme.company_name ?? ""}
          onChange={(e) => patch({ company_name: e.target.value || null })}
          className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent]"
        />
        <span className="t-label">担当者</span>
        <input
          type="text"
          value={theme.contact_name ?? ""}
          onChange={(e) => patch({ contact_name: e.target.value || null })}
          className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent]"
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
          className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent]"
        />
        <span className="t-label">サムネ画像 URL</span>
        <input
          type="url"
          value={theme.thumbnail_url ?? ""}
          onChange={(e) => patch({ thumbnail_url: e.target.value || null })}
          placeholder="https://images.example.com/cover.jpg"
          className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent] t-mono"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <label className="block">
          <span className="t-label block mb-1">カテゴリ</span>
          <select
            value={theme.category ?? ""}
            onChange={(e) =>
              patch({
                category: (e.target.value || null) as Theme["category"],
              })
            }
            className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent]"
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
            className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent]"
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
              onChange={(e) =>
                patch({ criteria_region: e.target.checked })
              }
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
        className="w-full rounded-md border border-line bg-white px-2.5 py-2 text-[12px] outline-none focus:border-[--c-accent] resize-none leading-relaxed"
      />
    </label>
  );
}

/** リソースを 1 行 = 1 アイテムで保存する箇条書きエディタ。
 *  内部的には改行区切り文字列として保存する。
 *  既存の resource_other (legacy) を初回マージ表示する。 */
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
  // value (prize) と legacyOther (resource_other) を合体して行に分解
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
      {hint && (
        <p className="t-cap mb-2 leading-relaxed opacity-80">{hint}</p>
      )}
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
              className="flex-1 rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent]"
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
