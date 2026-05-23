"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * モバイル (<md) 用のナビゲーション。
 * - ヘッダー左上にハンバーガーボタン (md:hidden)
 * - タップで左からドロワーをスライド表示。中身は OrgRail / ProjectPane の
 *   variant="drawer" を流し込む (children)
 * - 画面遷移 (pathname 変化) で自動的に閉じる
 * - 背景タップ / ✕ / Esc で閉じる
 * デスクトップ (md以上) では一切表示されない (左固定サイドバーが出るため)。
 */
export function MobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // 画面遷移したらドロワーを閉じる
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // 開いている間は背面スクロールをロック + Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="メニューを開く"
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-0 left-0 z-30 h-[74px] w-14 grid place-items-center text-ink"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && (
        <div className="md:hidden fixed inset-0 z-[90]" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <button
            type="button"
            aria-label="メニューを閉じる"
            onClick={() => setOpen(false)}
            className="absolute top-3 right-3 z-[92] grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink shadow-lg"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
          <div className="absolute inset-y-0 left-0 z-[91] flex h-full shadow-[0_0_60px_-10px_rgba(0,0,0,.5)]">
            {children}
          </div>
        </div>
      )}
    </>
  );
}
