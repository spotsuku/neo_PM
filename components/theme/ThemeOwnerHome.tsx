"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { themeStatusMeta } from "@/lib/themeStatus";

export interface ThemeCard {
  id: string;
  code: string | null;
  title: string;
  company_name: string | null;
  status: string;
  deadline: string | null;
  thumbnail_url: string | null;
  description_long: string | null;
  background: string | null;
  review_note: string | null;
  is_demo: boolean;
}

export interface ReviewQueueItem {
  id: string;
  code: string | null;
  title: string;
  company_name: string | null;
  submitted_at: string | null;
  status?: string;
  updated_at?: string;
}

interface Props {
  orgSlug: string;
  orgId: string;
  orgName: string;
  currentUserId: string;
  isAdmin: boolean;
  /** 新規テーマ作成権限 (owner / admin / theme_owner)。false の人は
   *  共同編集者 / 閲覧者として呼ばれているテーマだけを見る画面になる。 */
  canPost?: boolean;
  themes: ThemeCard[];
  reviewQueue: ReviewQueueItem[];
  /** 管理者用: 他の出題者が編集中のテーマ (draft / changes_requested) */
  othersEditingQueue?: ReviewQueueItem[];
  /** 共同編集者 / 閲覧者として呼ばれているテーマ */
  collaboratedThemes?: (ThemeCard & { collabRole: "editor" | "viewer" })[];
}

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("ja-JP", { month: "long", day: "numeric" }) : null;

export function ThemeOwnerHome({
  orgSlug,
  orgId,
  orgName,
  currentUserId,
  isAdmin,
  canPost = true,
  themes,
  reviewQueue,
  othersEditingQueue = [],
  collaboratedThemes = [],
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (id: string) => router.push(`/${orgSlug}/theme?t=${id}`);

  const createNew = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("themes")
      .insert({
        organization_id: orgId,
        title: "新しいテーマ",
        code: `NEO-${String(themes.length + 1).padStart(3, "0")}`,
        status: "draft",
        posted_by: currentUserId,
      })
      .select("id")
      .single();
    if (err || !data) {
      setCreating(false);
      setError(err?.message ?? "作成に失敗しました");
      return;
    }
    router.push(`/${orgSlug}/theme?t=${data.id}`);
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
              {orgName} ・ あなたが出題するテーマの一覧
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canPost && (
            <button
              type="button"
              onClick={createNew}
              disabled={creating}
              className="rounded-full bg-ink px-4 py-1.5 text-[12px] font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              {creating ? "作成中…" : "＋ 新規テーマ作成"}
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

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 管理者: 審査待ちキュー */}
      {isAdmin && reviewQueue.length > 0 && (
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="t-h3">⏳ 審査待ち</h2>
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-warn px-1.5 text-[11px] font-bold text-white">
              {reviewQueue.length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {reviewQueue.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => router.push(`/${orgSlug}/theme?t=${r.id}`)}
                className="flex items-center justify-between gap-3 rounded-xl border border-line-soft bg-white/70 px-3 py-2.5 text-left hover:border-[--c-accent] transition"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-[13px] truncate">
                    {r.code ? `${r.code} · ` : ""}
                    {r.title}
                  </div>
                  <div className="t-cap truncate">
                    {r.company_name ?? "—"}
                    {r.submitted_at ? ` ・ 申請 ${fmtDate(r.submitted_at)}` : ""}
                  </div>
                </div>
                <span className="rounded-full bg-ink px-3 py-1 text-[11px] font-bold text-white whitespace-nowrap">
                  審査する →
                </span>
              </button>
            ))}
          </div>
        </GlassCard>
      )}

      {/* 管理者: 他の出題者が編集中のテーマ */}
      {isAdmin && othersEditingQueue.length > 0 && (
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="t-h3">✍️ 他の出題者の編集中テーマ</h2>
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[--c-accent] px-1.5 text-[11px] font-bold text-white">
              {othersEditingQueue.length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {othersEditingQueue.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => router.push(`/${orgSlug}/theme?t=${r.id}`)}
                className="flex items-center justify-between gap-3 rounded-xl border border-line-soft bg-white/70 px-3 py-2.5 text-left hover:border-[--c-accent] transition"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-[13px] truncate">
                    {r.code ? `${r.code} · ` : ""}
                    {r.title}
                  </div>
                  <div className="t-cap truncate">
                    {r.company_name ?? "—"}
                    {r.status === "changes_requested"
                      ? " ・ 差し戻し中"
                      : " ・ 記載中"}
                    {r.updated_at ? ` ・ 更新 ${fmtDate(r.updated_at)}` : ""}
                  </div>
                </div>
                <span className="rounded-full bg-white border border-line text-mute px-3 py-1 text-[11px] font-bold whitespace-nowrap">
                  内容を見る →
                </span>
              </button>
            ))}
          </div>
        </GlassCard>
      )}

      {/* 自分の出題一覧 (canPost が false の人には「あなたの出題」は出さず、
          下の 🤝 共同編集中のテーマ だけ表示) */}
      {(canPost || themes.length > 0) && (
      <div>
        <h2 className="t-h3 mb-3 px-1">📋 あなたの出題</h2>
        {themes.length === 0 ? (
          <GlassCard className="p-10 grid place-items-center text-center">
            <div className="max-w-md">
              <div className="text-5xl mb-3">📭</div>
              <h3 className="t-h2 mb-2">まだテーマがありません</h3>
              <p className="t-cap mb-5 leading-relaxed">
                テーマを作成して内容を記載し、申請すると管理者の審査に進みます。
                承認されると応募一覧に公開されます。
              </p>
              <button
                type="button"
                onClick={createNew}
                disabled={creating}
                className="rounded-full bg-ink px-5 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50"
              >
                {creating ? "作成中…" : "＋ 新しいテーマを作成"}
              </button>
            </div>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {themes.map((t) => renderCard(t, open, null))}
          </div>
        )}
      </div>
      )}

      {/* 共同編集者/閲覧者として呼ばれているテーマ */}
      {collaboratedThemes.length > 0 && (
        <div>
          <h2 className="t-h3 mb-3 px-1">🤝 共同編集中のテーマ</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {collaboratedThemes.map((t) => renderCard(t, open, t.collabRole))}
          </div>
        </div>
      )}
    </div>
  );
}

/** テーマカード描画 (自分の出題 / 共同編集中で共用)。
 *  collabRole が指定されているとそのバッジを表示。 */
function renderCard(
  t: ThemeCard,
  open: (id: string) => void,
  collabRole: "editor" | "viewer" | null,
) {
  const meta = themeStatusMeta(t.status);
  const summary = (t.description_long || t.background || "").trim();
  return (
    <button
      key={t.id}
      type="button"
      onClick={() => open(t.id)}
      className="text-left rounded-2xl border border-line-soft bg-white/70 overflow-hidden hover:border-[--c-accent] hover:shadow-sm transition flex flex-col"
    >
      <div
        className="h-24 bg-canvas-2 bg-cover bg-center"
        style={
          t.thumbnail_url
            ? { backgroundImage: `url(${t.thumbnail_url})` }
            : undefined
        }
      >
        <div className="flex items-center justify-between p-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
            style={{ background: meta.color }}
          >
            {meta.emo} {meta.label}
          </span>
          {collabRole ? (
            <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-[--c-accent-deep]">
              🤝 {collabRole === "editor" ? "共同編集" : "閲覧"}
            </span>
          ) : (
            t.is_demo && (
              <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-warn">
                📌 見本
              </span>
            )
          )}
        </div>
      </div>
      <div className="p-3 flex flex-col gap-1 flex-1">
        {t.code && <div className="t-cap t-mono">{t.code}</div>}
        <div className="font-bold text-[14px] leading-snug line-clamp-2">
          {t.title}
        </div>
        {t.company_name && (
          <div className="t-cap truncate">{t.company_name}</div>
        )}
        {summary && (
          <p className="t-cap mt-1 line-clamp-2 opacity-80 leading-relaxed">
            {summary}
          </p>
        )}
        {t.status === "changes_requested" && t.review_note && (
          <div className="mt-2 rounded-md bg-red-50 px-2 py-1.5 text-[11px] text-red-700 line-clamp-2">
            ↩️ {t.review_note}
          </div>
        )}
        <div className="mt-auto pt-2 flex items-center justify-between">
          {t.deadline ? (
            <span className="t-cap">⏰ {fmtDate(t.deadline)}</span>
          ) : (
            <span />
          )}
          <span className="text-[11px] font-semibold text-[--c-accent-deep]">
            {collabRole === "viewer"
              ? "開く →"
              : t.status === "draft" || t.status === "changes_requested"
                ? "編集する →"
                : "開く →"}
          </span>
        </div>
      </div>
    </button>
  );
}
