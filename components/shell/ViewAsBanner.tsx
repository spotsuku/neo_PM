"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ViewAsBanner() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

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
        background:
          "linear-gradient(135deg, rgba(255,209,102,.95), rgba(184,134,11,.92))",
        color: "#0a0a0a",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span aria-hidden>👀</span>
        <strong>メンバー視点プレビュー中</strong>
        <span className="opacity-80">
          ・ プロジェクトに参加していないメンバーから何が見えるかを確認しています
        </span>
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
