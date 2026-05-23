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
}

interface Props {
  orgSlug: string;
  orgId: string;
  orgName: string;
  currentUserId: string;
  isAdmin: boolean;
  themes: ThemeCard[];
  reviewQueue: ReviewQueueItem[];
}

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("ja-JP", { month: "long", day: "numeric" }) : null;

export function ThemeOwnerHome({
  orgSlug,
  orgId,
  orgName,
  currentUserId,
  isAdmin,
  themes,
  reviewQueue,
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
          <button
            type="button"
            onClick={createNew}
            disabled={creating}
            className="rounded-full bg-ink px-4 py-1.5 text-[12px] font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            {creating ? "作成中…" : "＋ 新規テーマ作成"}
          </button>
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
                onClick={() => open(r.id)}
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

      {/* 自分の出題一覧 */}
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
            {themes.map((t) => {
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
                      {t.is_demo && (
                        <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-warn">
                          📌 見本
                        </span>
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
                        {t.status === "draft" || t.status === "changes_requested"
                          ? "編集する →"
                          : "開く →"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
