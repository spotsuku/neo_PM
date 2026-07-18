"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * 「ログイン画面へ戻る」等のリンクで、まず AI PM からサインアウトしてから
 * /login に遷移するクライアント component。
 *
 * 直接 `<a href="/login">` にすると、middleware.ts が「既にログイン中」判定で
 * /orgs に戻してしまうため、必ずサインアウトが必要。
 */
export function SignOutAndGoToLogin({
  children,
  className,
  next,
}: {
  children: React.ReactNode;
  className?: string;
  /** サインアウト後に /login?next=... へ引き継ぐパス */
  next?: string;
}) {
  const [busy, setBusy] = useState(false);
  const supabase = createClient();

  return (
    <button
      type="button"
      disabled={busy}
      className={className}
      onClick={async () => {
        setBusy(true);
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
        // SSR に反映させるため、リロード扱いで遷移
        const target =
          "/login" +
          (next ? `?next=${encodeURIComponent(next)}` : "?logout=1");
        window.location.href = target;
      }}
    >
      {busy ? "..." : children}
    </button>
  );
}
