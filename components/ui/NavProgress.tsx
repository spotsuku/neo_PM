"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** ナビゲーション中に画面上端に細い進捗バーを出す。
 *  - リンククリック (内部 navigation) をキャッチして瞬時にバーを伸ばす
 *  - pathname / search が変わったらバーを完了 → フェードアウト
 *  これで「クリック→反映」までの 0.5 秒前後を視覚的に埋める。 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);
  const lastKeyRef = useRef("");

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const target = (e.target as HTMLElement | null)?.closest("a");
      if (!target) return;
      if (target.getAttribute("target") === "_blank") return;
      if (target.hasAttribute("download")) return;
      const href = target.getAttribute("href") ?? "";
      if (!href.startsWith("/")) return;
      if (target.hostname && target.hostname !== window.location.hostname) return;
      // 同じ URL を再クリックした場合は反応しない
      if (
        target.pathname === window.location.pathname &&
        target.search === window.location.search
      )
        return;
      setActive(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    const key = `${pathname}?${search?.toString() ?? ""}`;
    if (lastKeyRef.current && lastKeyRef.current !== key) {
      // ナビ完了 → バーをサッと消す
      setActive(false);
    }
    lastKeyRef.current = key;
  }, [pathname, search]);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] h-[2px] pointer-events-none"
      aria-hidden
    >
      <div
        className="h-full"
        style={{
          background:
            "linear-gradient(90deg, var(--c-accent), var(--c-accent-deep))",
          boxShadow: "0 0 8px rgba(91,141,239,.6)",
          width: active ? "85%" : "0%",
          opacity: active ? 1 : 0,
          transition: active
            ? "width 8s cubic-bezier(.1,.5,.1,1)"
            : "width 0.15s ease, opacity 0.25s ease 0.1s",
        }}
      />
    </div>
  );
}
