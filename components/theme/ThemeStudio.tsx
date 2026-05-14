"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
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

interface Props {
  orgSlug: string;
  orgName: string;
  initialTheme: Theme;
}

export function ThemeStudio({ orgSlug, orgName, initialTheme }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [error, setError] = useState<string | null>(null);
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());

  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // デバウンス自動保存
  const patch = (p: Partial<Theme>) => {
    setTheme((prev) => ({ ...prev, ...p }));
    const keys = Object.keys(p).join(",");
    const existing = timersRef.current.get(keys);
    if (existing) clearTimeout(existing);
    setSavingFields((prev) => new Set(prev).add(keys));
    const tm = setTimeout(async () => {
      const { error: err } = await supabase
        .from("themes")
        .update(p as never)
        .eq("id", theme.id);
      setSavingFields((prev) => {
        const next = new Set(prev);
        next.delete(keys);
        return next;
      });
      if (err) setError(err.message);
      else setError(null);
    }, 600);
    timersRef.current.set(keys, tm);
  };

  useEffect(
    () => () => timersRef.current.forEach((t) => clearTimeout(t)),
    [],
  );

  const statusMeta =
    STATUSES.find((s) => s.key === theme.status) ?? STATUSES[0];
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

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 本体: 左プレビュー (sticky) / 右フォーム (page スクロール) */}
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
            <ApplicantPreview theme={theme} orgName={orgName} />
          </div>
        </aside>

        {/* 右: フォーム (page スクロール) */}
        <div className="flex flex-col gap-4">
          <ThemeForm theme={theme} patch={patch} />
        </div>
      </div>
    </div>
  );
}

/** 応募者画面の見え方を再現するプレビュー (apply page を踏襲) */
function ApplicantPreview({
  theme,
  orgName,
}: {
  theme: Theme;
  orgName: string;
}) {
  return (
    <GlassCard className="p-0 overflow-hidden">
      <div
        className="aspect-[16/9] max-h-[200px] flex items-center justify-center text-5xl"
        style={
          theme.thumbnail_url
            ? {
                backgroundImage: `url(${theme.thumbnail_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {
                background:
                  "linear-gradient(135deg, var(--c-accent-soft), var(--c-accent-bright))",
              }
        }
      >
        {!theme.thumbnail_url && <span aria-hidden>📣</span>}
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {theme.code && (
            <span className="t-mono text-[11px] text-mute">{theme.code}</span>
          )}
          {theme.category && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-[--c-accent-deep]">
              {theme.category === "new" ? "新規" : "リニューアル"}
            </span>
          )}
          <span className="t-cap">主催: {theme.company_name ?? orgName}</span>
        </div>
        <h2 className="text-[20px] font-extrabold tracking-tight mb-3 leading-snug">
          {theme.title || "（タイトル未入力）"}
        </h2>
        {theme.background && (
          <p className="text-[13px] leading-relaxed mb-3">{theme.background}</p>
        )}

        <div className="grid grid-cols-2 gap-2 t-cap mb-4">
          {theme.deadline && (
            <span>
              📅 締切:{" "}
              {new Date(theme.deadline).toLocaleDateString("ja-JP")}
            </span>
          )}
          {theme.prize && <span>🎁 特典: {theme.prize}</span>}
          {theme.who_target && (
            <span className="col-span-2">🎯 対象: {theme.who_target}</span>
          )}
          {theme.what_uniqueness && (
            <span className="col-span-2">
              ✨ 独自性: {theme.what_uniqueness}
            </span>
          )}
        </div>

        {theme.pain && (
          <PreviewSection label="課題（Pain）" body={theme.pain} />
        )}
        {theme.expected_outcome && (
          <PreviewSection
            label="期待される成果"
            body={theme.expected_outcome}
          />
        )}

        <button
          type="button"
          disabled
          className="w-full rounded-full bg-ink py-3 text-[13px] font-bold text-white opacity-70 cursor-not-allowed mt-4"
        >
          同意して応募 → （これは編集中のプレビューです）
        </button>
      </div>
    </GlassCard>
  );
}

function PreviewSection({ label, body }: { label: string; body: string }) {
  return (
    <div className="mb-3">
      <div className="t-label mb-1">{label}</div>
      <p className="text-[12.5px] leading-relaxed text-ink-2 whitespace-pre-wrap">
        {body}
      </p>
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
        <span className="t-label">タイトル</span>
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
        <span className="t-label">特典</span>
        <input
          type="text"
          value={theme.prize ?? ""}
          onChange={(e) => patch({ prize: e.target.value || null })}
          placeholder="例: 実証実験@2/9"
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
        label="背景"
        value={theme.background}
        onChange={(v) => patch({ background: v })}
        placeholder="このテーマが必要になった社会背景・経緯"
      />
      <Field
        label="ターゲット"
        value={theme.who_target}
        onChange={(v) => patch({ who_target: v })}
        placeholder="誰の何を解決したいか"
      />
      <Field
        label="課題（Pain）"
        value={theme.pain}
        onChange={(v) => patch({ pain: v })}
        placeholder="既存のやり方では解決できていないこと"
      />
      <Field
        label="独自性"
        value={theme.what_uniqueness}
        onChange={(v) => patch({ what_uniqueness: v })}
        placeholder="このテーマならではの新しさ"
      />
      <Field
        label="想定される受益"
        value={theme.what_benefit}
        onChange={(v) => patch({ what_benefit: v })}
        placeholder="誰がどう得をするか"
      />
      <Field
        label="期待される成果"
        value={theme.expected_outcome}
        onChange={(v) => patch({ expected_outcome: v })}
        placeholder="プロジェクトを通じて生まれる地域や人への変化"
      />
      <Field
        label="社内の壁（内部課題）"
        value={theme.internal_challenges}
        onChange={(v) => patch({ internal_challenges: v })}
        placeholder="現状の業務やリソースで足りていないこと"
      />
      <Field
        label="提供できるリソース"
        value={theme.resource_other}
        onChange={(v) => patch({ resource_other: v })}
        placeholder="人 / 場所 / データ / 予算 など"
      />
      <Field
        label="採択後のアクション"
        value={theme.post_action}
        onChange={(v) => patch({ post_action: v })}
        placeholder="採用された場合の次のステップ"
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
