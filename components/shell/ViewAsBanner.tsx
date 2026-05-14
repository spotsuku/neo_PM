"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Mode = "member" | "theme_owner";

const META: Record<
  Mode,
  { emo: string; title: string; sub: string; gradient: string }
> = {
  member: {
    emo: "👀",
    title: "メンバー視点プレビュー中",
    sub: "プロジェクトに参加していないメンバーから何が見えるかを確認しています",
    gradient:
      "linear-gradient(135deg, rgba(255,209,102,.95), rgba(184,134,11,.92))",
  },
  theme_owner: {
    emo: "📣",
    title: "テーマオーナー視点プレビュー中",
    sub: "ホーム / テーマ応募 / テーマ出題 だけが見える状態をプレビューしています",
    gradient:
      "linear-gradient(135deg, rgba(155,210,255,.95), rgba(70,120,200,.92))",
  },
};

export function ViewAsBanner({ mode = "member" }: { mode?: Mode }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const meta = META[mode];

  const exit = async () => {
    setBusy(true);
    await fetch("/api/view-as", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ view: null }),
    });
    router.refresh();
  };

  return (
    <div
      className="sticky top-[74px] z-20 px-6 py-2 text-[12px] flex items-center justify-between gap-3"
      style={{
        background: meta.gradient,
        color: "#0a0a0a",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span aria-hidden>{meta.emo}</span>
        <strong>{meta.title}</strong>
        <span className="opacity-80">・ {meta.sub}</span>
      </div>
      <button
        type="button"
        onClick={exit}
        disabled={busy}
        className="rounded-full bg-ink px-3 py-1 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
      >
        {busy ? "..." : "✕ 管理者ビューに戻る"}
      </button>
    </div>
  );
}
