"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import type { Database } from "@/lib/types/database";

type Theme = Database["public"]["Tables"]["themes"]["Row"];

interface Props {
  theme: Theme;
  /** プロジェクト出題側がフォールバックで使う組織名 */
  orgName?: string;
  /** 編集中プレビューなど、応募ボタンを無効化したいケース */
  applyButton?:
    | { kind: "preview" } // 「これは編集中のプレビューです」表示
    | { kind: "link"; href: string; label?: string } // 通常リンク
    | { kind: "disabled"; label: string } // 締切後など
    | { kind: "none" };
}

/** 応募者が見るテーマの公開ビュー。テーマ出題のプレビューと
 *  詳細ページの両方で使う。 */
export function ThemePublicView({
  theme,
  orgName,
  applyButton = { kind: "none" },
}: Props) {
  return (
    <GlassCard className="p-0 overflow-hidden">
      {/* サムネ */}
      <div
        className="aspect-[16/9] max-h-[280px] flex items-center justify-center text-6xl"
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

      <div className="p-5 md:p-6">
        {/* メタ行 */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {theme.code && (
            <span className="t-mono text-[11px] text-mute">{theme.code}</span>
          )}
          {theme.category && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-[--c-accent-deep]">
              {theme.category === "new" ? "新規" : "リニューアル"}
            </span>
          )}
          {theme.implementation_level && (
            <span className="rounded-full bg-mute/10 px-2 py-0.5 text-[10px] font-semibold text-mute">
              {theme.implementation_level === "poc" ? "PoC 段階" : "本格実装"}
            </span>
          )}
          <span className="t-cap">
            主催: {theme.company_name ?? orgName ?? "—"}
          </span>
          {theme.contact_name && (
            <span className="t-cap">・ 担当: {theme.contact_name}</span>
          )}
        </div>

        {/* タイトル + 概要 + 背景 */}
        <h2 className="text-[22px] md:text-[26px] font-extrabold tracking-tight mb-3 leading-snug">
          {theme.title || "（タイトル未入力）"}
        </h2>
        {theme.description_long && (
          <p className="text-[14px] leading-relaxed mb-3 whitespace-pre-wrap font-medium text-ink-2">
            {theme.description_long}
          </p>
        )}
        {theme.background && (
          <p className="text-[13.5px] leading-relaxed mb-4 whitespace-pre-wrap">
            {theme.background}
          </p>
        )}

        {/* 締切 + 提供リソース のサマリー行 */}
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3 mb-5 items-start">
          <div className="rounded-lg bg-white border border-line-soft px-3 py-2">
            <div className="t-label mb-0.5">
              <span className="mr-1" aria-hidden>
                📅
              </span>
              締切
            </div>
            <div className="text-[13.5px] font-extrabold leading-tight">
              {theme.deadline
                ? new Date(theme.deadline).toLocaleDateString("ja-JP")
                : "—"}
            </div>
          </div>
          <div className="rounded-lg bg-accent-soft/40 border border-line-soft px-3 py-2">
            <div className="t-label mb-1">
              <span className="mr-1" aria-hidden>
                🤝
              </span>
              提供リソース
            </div>
            <ResourceList prize={theme.prize} legacy={theme.resource_other} />
          </div>
        </div>

        {/* 本文セクション */}
        <div className="flex flex-col gap-4">
          {theme.who_target && (
            <Section emo="🧑‍🤝‍🧑" label="WHO (ターゲット)" body={theme.who_target} />
          )}
          {theme.pain && (
            <Section emo="🔥" label="問題" body={theme.pain} />
          )}
          {theme.what_benefit && (
            <Section
              emo="💎"
              label="WHAT (提供価値)"
              body={theme.what_benefit}
            />
          )}
          {theme.expected_outcome && (
            <Section
              emo="🌱"
              label="期待される成果"
              body={theme.expected_outcome}
            />
          )}
          {theme.what_uniqueness && (
            <Section
              emo="✨"
              label="独自性"
              body={theme.what_uniqueness}
            />
          )}
          {theme.internal_challenges && (
            <Section
              emo="🪤"
              label="実装する上でのリスク"
              body={theme.internal_challenges}
            />
          )}
          {theme.post_action && (
            <Section
              emo="🚀"
              label="採択後のアクション"
              body={theme.post_action}
            />
          )}
        </div>

        {/* 3 基準チェック */}
        {(theme.criteria_region ||
          theme.criteria_means ||
          theme.criteria_youth) && (
          <div className="mt-5 rounded-lg bg-accent-soft/50 p-3">
            <div className="t-label mb-2">📋 NEO テーマ出題 3 基準</div>
            <ul className="flex flex-col gap-1 text-[12px]">
              {theme.criteria_region && (
                <li>✓ 地域のためのテーマである</li>
              )}
              {theme.criteria_means && (
                <li>✓ 既存サービスは「手段」であって「目的」ではない</li>
              )}
              {theme.criteria_youth && (
                <li>✓ 若者が&quot;当事者&quot;として関われる余地がある</li>
              )}
            </ul>
          </div>
        )}

        {/* 応募ボタン */}
        <ApplyButton button={applyButton} />
      </div>
    </GlassCard>
  );
}

function ResourceList({
  prize,
  legacy,
}: {
  prize: string | null;
  legacy: string | null;
}) {
  const items = [prize, legacy]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join("\n")
    .split(/\r?\n/)
    .map((s) => s.replace(/^[・•\-\s]+/, "").trim())
    .filter(Boolean);
  if (items.length === 0) {
    return <p className="t-cap">—</p>;
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((it, i) => (
        <li
          key={i}
          className="text-[12.5px] font-semibold leading-snug flex items-start gap-1.5"
        >
          <span className="text-[--c-accent-deep]" aria-hidden>
            •
          </span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function Section({
  emo,
  label,
  body,
}: {
  emo: string;
  label: string;
  body: string;
}) {
  return (
    <div>
      <div className="t-label mb-1">
        <span className="mr-1" aria-hidden>
          {emo}
        </span>
        {label}
      </div>
      <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{body}</p>
    </div>
  );
}

function ApplyButton({ button }: { button: NonNullable<Props["applyButton"]> }) {
  if (button.kind === "none") return null;
  if (button.kind === "preview") {
    return (
      <button
        type="button"
        disabled
        className="w-full rounded-full bg-ink py-3 text-[13px] font-bold text-white opacity-60 cursor-not-allowed mt-6"
      >
        同意して応募 → （これは編集中のプレビューです）
      </button>
    );
  }
  if (button.kind === "disabled") {
    return (
      <button
        type="button"
        disabled
        className="w-full rounded-full bg-mute/15 py-3 text-[13px] font-bold text-mute cursor-not-allowed mt-6"
      >
        {button.label}
      </button>
    );
  }
  return (
    <a
      href={button.href}
      className="block text-center w-full rounded-full bg-ink py-3 text-[13px] font-bold text-white hover:opacity-90 mt-6"
    >
      {button.label ?? "✦ 応募申請する →"}
    </a>
  );
}
