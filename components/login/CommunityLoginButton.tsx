"use client";

import { useState } from "react";

import { COMMUNITY_CLIENT_ID, startCommunityLogin } from "@/lib/community-oauth";

/**
 * 「community_dashboard でログイン」ボタン。
 * client_id (env) が未設定のときは何も表示しない。
 */
export function CommunityLoginButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);

  if (!COMMUNITY_CLIENT_ID) return null;

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await startCommunityLogin(next);
        } catch {
          setBusy(false);
        }
      }}
      className="w-full flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-3 text-sm font-medium text-ink hover:bg-mute/5 transition mb-3 disabled:opacity-50"
    >
      <span aria-hidden>🌐</span>
      {busy ? "..." : "コミュニティポータルでログイン"}
    </button>
  );
}
