"use client";

import { useState } from "react";

import {
  COMMUNITY_CLIENT_ID,
  startCommunityLogin,
} from "@/lib/community-oauth";

// community_dashboard 側のログアウト URL (別タブで開いて Cookie を切る)
const COMMUNITY_LOGOUT_URL = "https://neo-fukuoka-members.web.app/logout";

/**
 * 「community_dashboard でログイン」ボタン。
 * client_id (env) が未設定のときは何も表示しない。
 */
export function CommunityLoginButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);

  if (!COMMUNITY_CLIENT_ID) return null;

  return (
    <div className="mb-3">
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
        className="w-full flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-3 text-sm font-medium text-ink hover:bg-mute/5 transition disabled:opacity-50"
      >
        <span aria-hidden>🌐</span>
        {busy ? "..." : "コミュニティポータルでログイン"}
      </button>
      <p className="t-cap mt-1.5 leading-relaxed opacity-75">
        すでに別アカウントで community にログイン済みの場合、そのアカウントで自動的にログインされます。別アカウントを使いたい方は{" "}
        <a
          href={COMMUNITY_LOGOUT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-ink"
        >
          先に community でログアウト
        </a>
        してください。
      </p>
    </div>
  );
}
