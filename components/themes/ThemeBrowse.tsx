"use client";

import Link from "next/link";

import { GlassCard } from "@/components/ui/GlassCard";
import type { Database } from "@/lib/types/database";

type Theme = Database["public"]["Tables"]["themes"]["Row"];
type AppStatus = Database["public"]["Tables"]["theme_applications"]["Row"]["status"];

interface MyApp {
  id: string;
  theme_id: string;
  status: AppStatus;
}

interface Props {
  orgSlug: string;
  themes: Theme[];
  myApps: MyApp[];
}

const STATUS_META: Record<
  AppStatus,
  { label: string; bg: string; cardBg: string | null; faded: boolean }
> = {
  draft: {
    label: "下書き",
    bg: "var(--mute)",
    cardBg: null,
    faded: false,
  },
  submitted: {
    label: "応募済み",
    bg: "var(--c-accent)",
    cardBg: "rgba(91,141,239,.06)",
    faded: false,
  },
  under_review: {
    label: "審査中",
    bg: "var(--warn)",
    cardBg: "rgba(255,176,32,.08)",
    faded: false,
  },
  approved: {
    label: "✓ 合格",
    bg: "var(--ok)",
    cardBg: "rgba(10,135,84,.10)",
    faded: false,
  },
  rejected: {
    label: "✕ 不採択",
    bg: "var(--error)",
    cardBg: null,
    faded: true,
  },
  withdrawn: {
    label: "取下げ",
    bg: "var(--mute)",
    cardBg: null,
    faded: true,
  },
};

const STATUS_CTA: Record<AppStatus, string> = {
  draft: "📝 下書きを編集 →",
  submitted: "📨 応募内容を見る →",
  under_review: "🔎 審査中の応募を見る →",
  approved: "🎉 採択結果を見る →",
  rejected: "結果を見る →",
  withdrawn: "取下げた応募を見る →",
};

export function ThemeBrowse({ orgSlug, themes, myApps }: Props) {
  const myAppByTheme = new Map(myApps.map((a) => [a.theme_id, a]));

  if (themes.length === 0) {
    return (
      <GlassCard className="p-10 text-center">
        <div className="text-5xl mb-4">📭</div>
        <h2 className="t-h2 mb-1">公開中のテーマがありません</h2>
        <p className="t-cap">
          現在募集中のテーマはありません。新しいテーマの掲載をお待ちください。
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {themes.map((t) => {
        const myApp = myAppByTheme.get(t.id);
        const statusMeta = myApp ? STATUS_META[myApp.status] : null;
        const deadlinePast =
          t.deadline !== null && new Date(t.deadline) < new Date();
        return (
          <Link
            key={t.id}
            href={`/${orgSlug}/themes/${t.id}`}
            className="block"
          >
          <GlassCard
            className={
              "p-0 overflow-hidden lift flex flex-col h-full hover:shadow-lg transition-shadow cursor-pointer " +
              (statusMeta?.faded ? "opacity-70" : "")
            }
            style={{
              borderLeft: statusMeta
                ? `4px solid ${statusMeta.bg}`
                : undefined,
              background: statusMeta?.cardBg ?? undefined,
            }}
          >
            {/* サムネ */}
            <div
              className="aspect-[16/9] bg-canvas-2 flex items-center justify-center text-4xl relative"
              style={
                t.thumbnail_url
                  ? {
                      backgroundImage: `url(${t.thumbnail_url})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : {
                      background:
                        "linear-gradient(135deg, var(--c-accent-soft), var(--c-accent-bright))",
                    }
              }
            >
              {!t.thumbnail_url && <span aria-hidden>📣</span>}
              {/* status chips top-left */}
              <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                {t.code && (
                  <span className="rounded-full bg-ink/70 px-2 py-0.5 text-[10px] font-mono text-white backdrop-blur">
                    {t.code}
                  </span>
                )}
                {t.category && (
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-ink backdrop-blur">
                    {t.category === "new" ? "新規" : "リニューアル"}
                  </span>
                )}
              </div>
              {/* my application status top-right */}
              {myApp && (
                <div className="absolute top-2 right-2">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white"
                    style={{ background: STATUS_META[myApp.status].bg }}
                  >
                    {STATUS_META[myApp.status].label}
                  </span>
                </div>
              )}
            </div>

            <div className="p-4 flex-1 flex flex-col">
              <h3 className="text-[14.5px] font-bold mb-1.5 leading-tight">
                {t.title}
              </h3>
              {t.company_name && (
                <p className="t-cap mb-2">主催: {t.company_name}</p>
              )}
              {t.background && (
                <p className="text-[12px] text-mute leading-relaxed mb-3 line-clamp-3">
                  {t.background}
                </p>
              )}
              <div className="mt-auto flex items-center justify-between gap-2 flex-wrap">
                <div className="t-cap flex items-center gap-2">
                  {t.deadline && (
                    <span className={deadlinePast ? "text-error" : ""}>
                      📅{" "}
                      {new Date(t.deadline).toLocaleDateString("ja-JP")}
                      {deadlinePast && " (締切)"}
                    </span>
                  )}
                  {t.prize && <span>🎁 {t.prize}</span>}
                </div>
                <span
                  className={
                    "rounded-full px-4 py-1.5 text-[11.5px] font-semibold transition " +
                    (myApp
                      ? myApp.status === "approved"
                        ? "bg-ok text-white"
                        : "bg-white border border-line text-mute"
                      : deadlinePast
                        ? "bg-mute/15 text-mute"
                        : "bg-ink text-white")
                  }
                >
                  {myApp
                    ? STATUS_CTA[myApp.status]
                    : deadlinePast
                      ? "締切済"
                      : "詳細を見る →"}
                </span>
              </div>
            </div>
          </GlassCard>
          </Link>
        );
      })}
    </div>
  );
}
