"use client";

import { useEffect, useState } from "react";

interface Piece {
  id: number;
  left: number;
  delay: number;
  color: string;
  rotate: number;
}

const COLORS = [
  "var(--c-accent)",
  "var(--c-accent-deep)",
  "var(--c-accent-bright)",
  "#ffd166",
  "#ef476f",
];

/** マウント時のみ降る、軽量コンフェッティ */
export function ConfettiBurst({ count = 24 }: { count?: number }) {
  const [pieces, setPieces] = useState<Piece[]>([]);
  useEffect(() => {
    setPieces(
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.3,
        color: COLORS[i % COLORS.length],
        rotate: Math.random() * 360,
      })),
    );
    const t = setTimeout(() => setPieces([]), 1600);
    return () => clearTimeout(t);
  }, [count]);

  if (pieces.length === 0) return null;
  return (
    <div
      aria-hidden
      data-c-fun="playful"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0 overflow-visible"
    >
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute block h-2.5 w-1.5 rounded-[2px]"
          style={{
            left: `${p.left}%`,
            top: 0,
            background: p.color,
            transform: `rotate(${p.rotate}deg)`,
            animation: `confetti 1.4s ease-out forwards`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
