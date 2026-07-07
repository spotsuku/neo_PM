"use client";

import { useEffect, useState } from "react";

import { consumeCommunityLoginState } from "@/lib/community-oauth";

const COMMUNITY_LOGOUT_URL = "https://neo-fukuoka-members.web.app/logout";

// community_dashboard ログイン後の戻り先。code を受け取りサーバへ渡して
// AI PM セッションを確立する専用ページ (トップ/既存ページと兼用しない)。
export const dynamic = "force-dynamic";

export default function CommunityCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  /** community 側の 「認可期限切れ / 既処理」系エラーの可能性が高いか */
  const [suspectCommunitySession, setSuspectCommunitySession] = useState(false);

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const oauthError = params.get("error");
      if (oauthError) {
        const desc =
          params.get("error_description") || `認証エラー: ${oauthError}`;
        setError(desc);
        // community 側で有効期限切れ / 既処理エラーが起きた時のヒント誘導
        if (
          /expired|already|invalid_request|access_denied/i.test(oauthError) ||
          /有効期限|処理済/i.test(desc)
        ) {
          setSuspectCommunitySession(true);
        }
        return;
      }
      const code = params.get("code");
      const returnedState = params.get("state");
      const { verifier, state, next } = consumeCommunityLoginState();

      if (!code || !returnedState || returnedState !== state || !verifier) {
        setError(
          "認証情報が不正です。ブラウザを閉じたり戻る操作をした場合に発生することがあります。もう一度ログインしてください。",
        );
        setSuspectCommunitySession(true);
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
          const msg = data.error ?? `ログインに失敗しました (${res.status})`;
          setError(msg);
          if (/token|expired|already|community/i.test(msg)) {
            setSuspectCommunitySession(true);
          }
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

            {suspectCommunitySession && (
              <div className="mb-5 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-[12.5px] text-amber-900 leading-relaxed text-left">
                <strong className="block mb-1">
                  💡 別ブラウザでの community ログインが原因かもしれません
                </strong>
                下記の順で試してください:
                <ol className="mt-2 ml-4 list-decimal space-y-1">
                  <li>
                    <a
                      href={COMMUNITY_LOGOUT_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-semibold hover:text-ink"
                    >
                      community でログアウト
                    </a>
                    （別タブで開きます）
                  </li>
                  <li>そのタブを閉じる</li>
                  <li>下のボタンで再度お試しください</li>
                </ol>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <a
                href="/login"
                className="inline-block rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                ログイン画面へ戻る
              </a>
              {suspectCommunitySession && (
                <a
                  href={COMMUNITY_LOGOUT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-lg border border-line bg-white px-5 py-2 text-[12.5px] font-medium text-mute hover:text-ink"
                >
                  🌐 community でログアウト (別タブ)
                </a>
              )}
            </div>
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
