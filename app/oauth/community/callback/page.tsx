"use client";

import { useEffect, useState } from "react";

import { consumeCommunityLoginState } from "@/lib/community-oauth";

// community_dashboard ログイン後の戻り先。code を受け取りサーバへ渡して
// AI PM セッションを確立する専用ページ (トップ/既存ページと兼用しない)。
export const dynamic = "force-dynamic";

export default function CommunityCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const oauthError = params.get("error");
      if (oauthError) {
        setError(
          params.get("error_description") || `認証エラー: ${oauthError}`,
        );
        return;
      }
      const code = params.get("code");
      const returnedState = params.get("state");
      const { verifier, state, next } = consumeCommunityLoginState();

      if (!code || !returnedState || returnedState !== state || !verifier) {
        setError("認証情報が不正です。お手数ですが、もう一度ログインしてください。");
        return;
      }

      try {
        const res = await fetch("/api/auth/community/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            verifier,
            redirectUri: `${window.location.origin}/oauth/community/callback`,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          setError(data.error ?? `ログインに失敗しました (${res.status})`);
          return;
        }
        // セッション Cookie が確立済み。SSR で確実に反映させるため全リロード。
        window.location.replace(next.startsWith("/") ? next : "/orgs");
      } catch (e) {
        setError(e instanceof Error ? e.message : "通信に失敗しました");
      }
    })();
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="glass-strong p-8 w-full max-w-md text-center animate-risein">
        {error ? (
          <>
            <div className="text-4xl mb-3" aria-hidden>
              ⚠️
            </div>
            <h1 className="t-h3 mb-2">ログインを完了できませんでした</h1>
            <p className="t-cap mb-5 leading-relaxed">{error}</p>
            <a
              href="/login"
              className="inline-block rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              ログイン画面へ戻る
            </a>
          </>
        ) : (
          <>
            <div className="text-4xl mb-3" aria-hidden>
              🌐
            </div>
            <h1 className="t-h3 mb-1">ログイン処理中…</h1>
            <p className="t-cap">community_dashboard と連携しています。</p>
          </>
        )}
      </div>
    </main>
  );
}
