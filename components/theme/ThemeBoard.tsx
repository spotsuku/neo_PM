"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import type { Database } from "@/lib/types/database";

type Theme = Database["public"]["Tables"]["themes"]["Row"];

const STATUSES: { key: Theme["status"]; label: string; emo: string; color: string }[] = [
  { key: "active", label: "公開中", emo: "🟢", color: "var(--ok)" },
  { key: "draft", label: "下書き", emo: "📝", color: "var(--mute)" },
  { key: "closed", label: "終了", emo: "📦", color: "var(--warn)" },
  { key: "archived", label: "アーカイブ", emo: "🗄", color: "var(--mute-2)" },
];

interface Props {
  orgSlug: string;
  orgId: string;
  orgName: string;
  initialThemes: Theme[];
  activeId: string | null;
}

export function ThemeBoard({
  orgSlug,
  orgId,
  orgName,
  initialThemes,
  activeId,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [themes, setThemes] = useState<Theme[]>(initialThemes);
  const [selectedId, setSelectedId] = useState<string | null>(
    activeId ?? initialThemes[0]?.id ?? null,
  );
  const [filter, setFilter] = useState<"all" | Theme["status"]>("all");
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: themes.length,
      active: 0,
      draft: 0,
      closed: 0,
      archived: 0,
    };
    for (const t of themes) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [themes]);

  const visible = useMemo(
    () => (filter === "all" ? themes : themes.filter((t) => t.status === filter)),
    [themes, filter],
  );
  const selected = themes.find((t) => t.id === selectedId) ?? null;

  // 楽観的 patch + デバウンス save
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const patchTheme = (id: string, patch: Partial<Theme>) => {
    setThemes((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const existing = timersRef.current.get(id);
    if (existing) clearTimeout(existing);
    const tm = setTimeout(async () => {
      const { error: err } = await supabase
        .from("themes")
        .update(patch as never)
        .eq("id", id);
      if (err) setError(err.message);
    }, 600);
    timersRef.current.set(id, tm);
  };

  useEffect(() => () => timersRef.current.forEach((t) => clearTimeout(t)), []);

  const createTheme = async () => {
    const seqCode = `NEO-${String(themes.length + 1).padStart(3, "0")}`;
    const { data, error: err } = await supabase
      .from("themes")
      .insert({
        organization_id: orgId,
        title: "新しいテーマ",
        code: seqCode,
        status: "draft",
      })
      .select()
      .single();
    if (err || !data) {
      setError(err?.message ?? "テーマの作成に失敗しました");
      return;
    }
    setThemes((prev) => [data, ...prev]);
    setSelectedId(data.id);
  };

  const removeTheme = async (id: string) => {
    if (!confirm("このテーマを削除しますか？")) return;
    setThemes((prev) => prev.filter((t) => t.id !== id));
    if (selectedId === id) setSelectedId(null);
    const { error: err } = await supabase.from("themes").delete().eq("id", id);
    if (err) setError(err.message);
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
              {orgName} ・ 企業 PR 担当者向けの出題管理
            </div>
          </div>
        </div>

        {/* Status chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <FilterChip
            label="すべて"
            count={counts.all}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          {STATUSES.map((s) => (
            <FilterChip
              key={s.key}
              label={s.label}
              count={counts[s.key] ?? 0}
              active={filter === s.key}
              emo={s.emo}
              onClick={() => setFilter(s.key)}
            />
          ))}
          <button
            type="button"
            onClick={createTheme}
            className="ml-2 rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white hover:opacity-90"
          >
            ＋ 新規テーマ
          </button>
        </div>
      </GlassCard>

      <div className="flex justify-end -mt-1">
        <Link
          href={`/${orgSlug}/themes/applications`}
          className="rounded-full bg-white px-4 py-1.5 text-[11.5px] font-semibold text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)]"
        >
          📋 応募の管理へ →
        </Link>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4 lg:gap-5">
        {/* 左: テーマ一覧 */}
        <div className="flex flex-col gap-3">
          {visible.length === 0 ? (
            <GlassCard className="p-10 text-center">
              <div className="text-4xl mb-3">📋</div>
              <h3 className="t-h3 mb-1">該当するテーマがありません</h3>
              <p className="t-cap mb-5">
                「＋ 新規テーマ」から最初の1件を作成してください。
              </p>
            </GlassCard>
          ) : (
            visible.map((t) => (
              <ThemeCard
                key={t.id}
                theme={t}
                selected={t.id === selectedId}
                onSelect={() => {
                  setSelectedId(t.id);
                  router.replace(`/${orgSlug}/theme?id=${t.id}`, { scroll: false });
                }}
                onDelete={() => removeTheme(t.id)}
              />
            ))
          )}
        </div>

        {/* 右: 詳細 + プレビュー */}
        <div className="flex flex-col gap-4">
          {selected ? (
            <>
              <ThemeDetailEditor theme={selected} onPatch={patchTheme} />
              <ThemePublicPreview theme={selected} orgName={orgName} />
            </>
          ) : (
            <GlassCard className="p-10 text-center">
              <div className="text-4xl mb-3">👈</div>
              <h3 className="t-h3 mb-1">左からテーマを選択</h3>
              <p className="t-cap">
                テーマを選ぶと詳細編集と公開プレビューが表示されます。
              </p>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
  emo,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  emo?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition " +
        (active
          ? "bg-ink text-white"
          : "bg-white text-mute hover:bg-mute/5")
      }
    >
      {emo && <span aria-hidden>{emo}</span>}
      <span>{label}</span>
      <span
        className={
          "rounded-full px-1.5 text-[10px] " +
          (active ? "bg-white/20" : "bg-mute/10 text-mute")
        }
      >
        {count}
      </span>
    </button>
  );
}

function ThemeCard({
  theme,
  selected,
  onSelect,
  onDelete,
}: {
  theme: Theme;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const statusMeta = STATUSES.find((s) => s.key === theme.status) ?? STATUSES[1];
  return (
    <div
      className={
        "group glass p-4 lift cursor-pointer " +
        (selected ? "ring-2 ring-[--c-accent]" : "")
      }
      onClick={onSelect}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {theme.code && (
            <span className="t-mono text-[11px] text-mute">{theme.code}</span>
          )}
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
            style={{ background: statusMeta.color }}
          >
            {statusMeta.emo} {statusMeta.label}
          </span>
          {theme.category && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-[--c-accent-deep]">
              {theme.category === "new" ? "新規" : "リニューアル"}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 rounded-md px-1.5 py-0.5 text-[11px] text-mute hover:bg-red-50 hover:text-error transition"
        >
          ✕
        </button>
      </div>
      <h3 className="text-[14px] font-bold mb-1.5 leading-tight">{theme.title}</h3>
      <div className="flex items-center gap-3 t-cap">
        {theme.company_name && <span>主催: {theme.company_name}</span>}
        {theme.deadline && (
          <span>締切: {new Date(theme.deadline).toLocaleDateString("ja-JP")}</span>
        )}
      </div>
    </div>
  );
}

function ThemeDetailEditor({
  theme,
  onPatch,
}: {
  theme: Theme;
  onPatch: (id: string, patch: Partial<Theme>) => void;
}) {
  const patch = (p: Partial<Theme>) => onPatch(theme.id, p);

  return (
    <GlassCard className="p-5">
      <h3 className="t-h3 mb-3">
        <span aria-hidden className="mr-2">
          📝
        </span>
        テーマ詳細
      </h3>

      <div className="grid grid-cols-[100px_1fr] gap-2 mb-3 items-center">
        <span className="t-label">コード</span>
        <input
          type="text"
          defaultValue={theme.code ?? ""}
          onBlur={(e) => patch({ code: e.target.value || null })}
          className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent] t-mono"
        />
        <span className="t-label">タイトル</span>
        <input
          type="text"
          defaultValue={theme.title}
          onBlur={(e) => patch({ title: e.target.value })}
          className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] font-semibold outline-none focus:border-[--c-accent]"
        />
        <span className="t-label">主催企業</span>
        <input
          type="text"
          defaultValue={theme.company_name ?? ""}
          onBlur={(e) => patch({ company_name: e.target.value || null })}
          className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent]"
        />
        <span className="t-label">担当者</span>
        <input
          type="text"
          defaultValue={theme.contact_name ?? ""}
          onBlur={(e) => patch({ contact_name: e.target.value || null })}
          className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent]"
        />
        <span className="t-label">締切</span>
        <input
          type="date"
          defaultValue={theme.deadline ? theme.deadline.slice(0, 10) : ""}
          onBlur={(e) =>
            patch({
              deadline: e.target.value
                ? new Date(e.target.value).toISOString()
                : null,
            })
          }
          className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent]"
        />
        <span className="t-label">特典</span>
        <input
          type="text"
          defaultValue={theme.prize ?? ""}
          onBlur={(e) => patch({ prize: e.target.value || null })}
          placeholder="例: 実証実験@2/9"
          className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent]"
        />
        <span className="t-label">サムネ画像 URL</span>
        <input
          type="url"
          defaultValue={theme.thumbnail_url ?? ""}
          onBlur={(e) => patch({ thumbnail_url: e.target.value || null })}
          placeholder="https://images.example.com/cover.jpg"
          className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent] t-mono"
        />
      </div>

      {theme.thumbnail_url && (
        <div className="rounded-lg overflow-hidden border border-line-soft mb-3 aspect-[16/9] max-h-[140px]"
             style={{
               backgroundImage: `url(${theme.thumbnail_url})`,
               backgroundSize: "cover",
               backgroundPosition: "center",
             }}
        />
      )}

      <div className="grid grid-cols-2 gap-2 mb-4">
        <label className="block">
          <span className="t-label block mb-1">カテゴリ</span>
          <select
            defaultValue={theme.category ?? ""}
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
          <span className="t-label block mb-1">ステータス</span>
          <select
            value={theme.status}
            onChange={(e) =>
              patch({ status: e.target.value as Theme["status"] })
            }
            className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent]"
          >
            {STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* 3基準チェック */}
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
            <span>③ 若者が"当事者"として関われる余地があること</span>
          </label>
        </div>
      </div>

      <Field
        label="背景"
        value={theme.background}
        onCommit={(v) => patch({ background: v })}
        placeholder="このテーマが必要になった社会背景・経緯"
      />
      <Field
        label="ターゲット"
        value={theme.who_target}
        onCommit={(v) => patch({ who_target: v })}
        placeholder="誰の何を解決したいか"
      />
      <Field
        label="課題（Pain）"
        value={theme.pain}
        onCommit={(v) => patch({ pain: v })}
        placeholder="既存のやり方では解決できていないこと"
      />
      <Field
        label="独自性"
        value={theme.what_uniqueness}
        onCommit={(v) => patch({ what_uniqueness: v })}
        placeholder="このテーマならではの新しさ"
      />
      <Field
        label="期待される成果"
        value={theme.expected_outcome}
        onCommit={(v) => patch({ expected_outcome: v })}
        placeholder="プロジェクトを通じて生まれる地域や人への変化"
      />
    </GlassCard>
  );
}

function Field({
  label,
  value,
  onCommit,
  placeholder,
}: {
  label: string;
  value: string | null;
  onCommit: (v: string | null) => void;
  placeholder?: string;
}) {
  return (
    <label className="block mb-2.5">
      <span className="t-label block mb-1">{label}</span>
      <textarea
        rows={2}
        defaultValue={value ?? ""}
        onBlur={(e) => onCommit(e.target.value || null)}
        placeholder={placeholder}
        className="w-full rounded-md border border-line bg-white px-2.5 py-2 text-[12px] outline-none focus:border-[--c-accent] resize-none"
      />
    </label>
  );
}

function ThemePublicPreview({
  theme,
  orgName,
}: {
  theme: Theme;
  orgName: string;
}) {
  const statusMeta = STATUSES.find((s) => s.key === theme.status) ?? STATUSES[1];
  const isPublic = theme.status === "active";
  return (
    <GlassCard variant="dark" className="p-6">
      <div className="flex items-center justify-between mb-4 opacity-80">
        <span className="t-label">🌐 公開プレビュー</span>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
          style={{
            background: isPublic ? "rgba(10,135,84,.25)" : "rgba(255,255,255,.1)",
          }}
        >
          {statusMeta.emo} {statusMeta.label}
        </span>
      </div>

      {theme.code && (
        <div className="t-mono text-[11px] opacity-70 mb-1">{theme.code}</div>
      )}
      <div className="text-[12px] opacity-80 mb-2">
        主催: {theme.company_name ?? orgName}
      </div>
      <h2 className="text-[22px] font-extrabold leading-snug mb-4">
        {theme.title}
      </h2>

      {theme.background && (
        <p className="text-[13px] leading-relaxed opacity-90 mb-4">
          {theme.background}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-lg bg-white/5 p-3">
          <div className="t-label opacity-70 mb-1">締切</div>
          <div className="text-[13px] font-semibold">
            {theme.deadline
              ? new Date(theme.deadline).toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "未定"}
          </div>
        </div>
        <div className="rounded-lg bg-white/5 p-3">
          <div className="t-label opacity-70 mb-1">特典</div>
          <div className="text-[13px] font-semibold">
            {theme.prize ?? "—"}
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={!isPublic}
        className={
          "w-full rounded-full py-3 text-[13px] font-bold transition " +
          (isPublic
            ? "bg-white text-ink hover:bg-accent-soft"
            : "bg-white/10 text-white/50 cursor-not-allowed")
        }
      >
        {isPublic ? "同意して応募 →" : "（公開時に応募ボタンが有効化）"}
      </button>
    </GlassCard>
  );
}
