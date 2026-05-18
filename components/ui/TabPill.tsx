"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

interface TabPillProps {
  href: string;
  emo: string;
  label: string;
  active?: boolean;
}

export function TabPill({ href, emo, label, active = false }: TabPillProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] transition-all",
        active
          ? "bg-ink text-white font-semibold shadow-[0_2px_12px_rgba(10,10,10,.18)]"
          : "bg-white text-mute font-medium shadow-[0_1px_0_var(--line-soft)] hover:bg-accent-soft hover:text-[--c-accent-deep]",
      )}
    >
      <span aria-hidden>{emo}</span>
      {label}
    </Link>
  );
}
