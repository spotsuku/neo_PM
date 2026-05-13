"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

interface FloatingAIProps {
  /** プロジェクト ID（未指定なら組織コンテキスト） */
  projectId?: string;
  /** 未読提案件数 */
  unread?: number;
}

export function FloatingAI({ projectId, unread = 0 }: FloatingAIProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 吹き出し（閉じている時のみ）*/}
      {!open && (
        <div
          className="glass-dark fixed bottom-[110px] right-7 z-40 max-w-[280px] rounded-[14px_14px_0_14px] px-4 py-3 text-[12px] leading-relaxed animate-risein"
          style={{ pointerEvents: "none" }}
        >
          今週の Why を 3分で整理しませんか？ ✨
        </div>
      )}

      {/* メインボタン */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-7 right-7 z-50 grid h-[60px] w-[60px] place-items-center rounded-full border-2 border-white text-white outline-none"
        style={{
          background:
            "linear-gradient(160deg, #1a2540 0%, var(--c-accent-deep) 60%, var(--c-accent) 100%)",
          boxShadow:
            "0 14px 36px -8px rgba(40,80,180,.55), 0 0 0 6px rgba(91,141,239,.12), inset 0 1px 0 rgba(255,255,255,.35)",
        }}
        aria-label="AI 伴走者を開く"
      >
        <span className="text-[26px] leading-none" style={{ animation: "sparkle 3s ease-in-out infinite" }}>
          ✦
        </span>
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-white px-1 text-[10px] font-bold text-[--c-accent-deep]"
            style={{ animation: "badgePop .5s ease-out" }}
          >
            {unread}
          </span>
        )}
      </button>

      {/* 展開パネル */}
      {open && (
        <div
          className={cn(
            "glass-strong fixed bottom-[100px] right-7 z-40 flex w-[420px] max-w-[calc(100vw-3.5rem)] flex-col rounded-[14px] animate-risein",
            "max-h-[calc(100vh-160px)]",
          )}
        >
          <div className="glass-dark flex items-center gap-3 rounded-t-[14px] px-4 py-3">
            <div
              className="grid h-8 w-8 place-items-center rounded-full text-white"
              style={{
                background:
                  "conic-gradient(from 220deg, var(--c-accent), var(--c-accent-deep) 60%, #0a0a0a)",
              }}
            >
              ✦
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-semibold">NEO.ai</div>
              <div className="text-[10px] opacity-70">あなたの伴走者</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-1 text-white/80 hover:bg-white/10"
              aria-label="閉じる"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 text-[12.5px] text-ink-2 leading-relaxed">
            {projectId ? (
              <p>プロジェクトの現状を読み込み中…</p>
            ) : (
              <div className="space-y-2.5">
                <p>
                  NEO.ai
                  はプロジェクトの文脈に合わせて返答します。チャットを使うには、
                  まずプロジェクト画面（ダッシュボード・WBS・実行計画など）に移動してください。
                </p>
                <p className="text-mute text-[11.5px]">
                  ヒント: 上のタブから「🚀 ダッシュ」「📋 WBS」などをクリック →
                  そのプロジェクトの文脈で AI と会話できます。フルチャットは「✨ AI 伴走」タブから。
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
