"use client";

import Link, { useLinkStatus } from "next/link";

import { cn } from "@/lib/utils";

interface TabPillProps {
  href: string;
  emo: string;
  label: string;
  active?: boolean;
}

/** Link 配下で動く子 = 自分のリンク先への navigation 中だけ pending=true */
function TabPillInner({
  emo,
  label,
  active,
}: {
  emo: string;
  label: string;
  active: boolean;
}) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] transition-colors duration-100",
        active
          ? "bg-ink text-white font-semibold shadow-[0_2px_12px_rgba(10,10,10,.18)]"
          : pending
            ? "bg-accent-soft text-[--c-accent-deep] font-semibold"
            : "bg-white text-mute font-medium shadow-[0_1px_0_var(--line-soft)] hover:bg-accent-soft hover:text-[--c-accent-deep]",
      )}
    >
      <span aria-hidden className={pending ? "animate-pulse" : ""}>
        {pending ? "✦" : emo}
      </span>
      {label}
    </span>
  );
}

export function TabPill({ href, emo, label, active = false }: TabPillProps) {
  return (
    <Link href={href} prefetch className="inline-flex">
      <TabPillInner emo={emo} label={label} active={active} />
    </Link>
  );
}
