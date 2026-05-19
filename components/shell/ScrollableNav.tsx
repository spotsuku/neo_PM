"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  children: React.ReactNode;
  /** 競争タブ用 (右端にあるので border-l で main と区切る) */
  variant?: "main" | "comp";
}

/** 横スクロール可能なナビ。左右に隠れた要素がある時、
 *  視覚的にフェード + シェブロンで「まだある」ことを示す。 */
export function ScrollableNav({ children, variant = "main" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setOverflow({
        left: el.scrollLeft > 4,
        right: el.scrollWidth - el.clientWidth - el.scrollLeft > 4,
      });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  const scrollBy = (dx: number) => {
    ref.current?.scrollBy({ left: dx, behavior: "smooth" });
  };

  return (
    <div
      className={
        "relative flex items-center " +
        (variant === "comp"
          ? "flex-shrink-0 border-l border-line-soft pl-2 ml-1"
          : "flex-1 min-w-0")
      }
    >
      {/* 左フェード + ボタン */}
      {overflow.left && (
        <>
          <span
            className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10"
            style={{
              background:
                "linear-gradient(to right, rgba(255,255,255,0.95), rgba(255,255,255,0))",
            }}
            aria-hidden
          />
          <button
            type="button"
            onClick={() => scrollBy(-200)}
            aria-label="左にスクロール"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 grid h-7 w-7 place-items-center rounded-full bg-white/90 shadow-[0_2px_8px_rgba(15,23,42,.12)] text-mute hover:text-ink hover:bg-white"
          >
            ‹
          </button>
        </>
      )}

      <nav
        ref={ref}
        className="flex items-center gap-1.5 overflow-x-auto px-2 no-scrollbar"
        style={{ scrollbarWidth: "none" }}
      >
        {children}
      </nav>

      {/* 右フェード + ボタン */}
      {overflow.right && (
        <>
          <span
            className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 z-10"
            style={{
              background:
                "linear-gradient(to left, rgba(255,255,255,0.95), rgba(255,255,255,0))",
            }}
            aria-hidden
          />
          <button
            type="button"
            onClick={() => scrollBy(200)}
            aria-label="右にスクロール"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 grid h-7 w-7 place-items-center rounded-full bg-white/95 shadow-[0_2px_8px_rgba(15,23,42,.12)] text-mute hover:text-ink hover:bg-white animate-pulse"
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}
