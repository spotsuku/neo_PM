"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { AppLogo } from "@/components/ui/AppLogo";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "sent" }
  | { kind: "error"; message: string; rateLimited?: boolean };

function jpAuthError(message: string): {
  text: string;
  rateLimited: boolean;
} {
  if (/email rate limit/i.test(message) || /rate limit/i.test(message)) {
    return {
      text: "メール送信の制限に達しました。1時間ほど待ってから再度お試しください。",
      rateLimited: true,
    };
  }
  if (/invalid login credentials/i.test(message)) {
    return {
      text: "メールアドレスかパスワードが違います。",
      rateLimited: false,
    };
  }
  if (/email not confirmed/i.test(message)) {
    return {
      text: "メール確認が完了していません。受信箱のリンクをクリックしてください。",
      rateLimited: false,
    };
  }
  return { text: message, rateLimited: false };
}

// magic link 送信のクールダウン（秒）
const COOLDOWN_SECONDS = 60;
const COOLDOWN_KEY = "neo-pm:magic-link-cooldown-until";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") ?? "/orgs";
  const justLoggedOut = search.get("logout") === "1";
  const prefillEmail = search.get("email") ?? "";

  const supabase = createClient();
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [cooldown, setCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  // セッションストレージに保存したクールダウン終了時刻を毎秒チェック
  useEffect(() => {
    const tick = () => {
      if (typeof window === "undefined") return;
      const untilStr = sessionStorage.getItem(COOLDOWN_KEY);
      if (!untilStr) {
        setCooldown(0);
        return;
      }
      const until = parseInt(untilStr, 10);
      const remain = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setCooldown(remain);
      if (remain === 0) sessionStorage.removeItem(COOLDOWN_KEY);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const startCooldown = (seconds: number) => {
    if (typeof window === "undefined") return;
    const until = Date.now() + seconds * 1000;
    sessionStorage.setItem(COOLDOWN_KEY, String(until));
    setCooldown(seconds);
  };

  const buildRedirect = (path = "/auth/callback") =>
    `${window.location.origin}${path}?next=${encodeURIComponent(next)}`;

  const signInWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setStatus({
        kind: "error",
        message: "メールアドレスとパスワードを入力してください。",
      });
      return;
    }
    setStatus({ kind: "loading" });
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      const { text, rateLimited } = jpAuthError(error.message);
      setStatus({ kind: "error", message: text, rateLimited });
      return;
    }
    router.push(next);
    router.refresh();
  };

  const sendMagicLink = async () => {
    if (!email.trim()) {
      setStatus({
        kind: "error",
        message: "メールアドレスを入力してください。",
      });
      return;
    }
    if (cooldown > 0) return;
    setStatus({ kind: "loading" });
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: buildRedirect() },
    });
    if (error) {
      const { text, rateLimited } = jpAuthError(error.message);
      setStatus({ kind: "error", message: text, rateLimited });
      // レートリミット時はクールダウンを長め (5分) にする
      if (rateLimited) startCooldown(300);
      return;
    }
    setStatus({ kind: "sent" });
    startCooldown(COOLDOWN_SECONDS);
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: buildRedirect() },
    });
    if (error) {
      const { text, rateLimited } = jpAuthError(error.message);
      setStatus({ kind: "error", message: text, rateLimited });
    }
  };

  return (
    <div className="glass-strong p-8 md:p-10 w-full max-w-md animate-risein">
      <div className="text-center mb-6">
        <AppLogo className="inline-block h-14 w-14 mb-3" />
        <h1 className="t-h2 mb-1">AI PM へようこそ</h1>
        <p className="t-cap">誰もが プロジェクトマネージャー になるためのダッシュボード</p>
      </div>

      {justLoggedOut && (
        <div className="mb-5 rounded-lg bg-accent-soft px-4 py-3 text-sm text-[--c-accent-deep] text-center">
          👋 ログアウトしました
        </div>
      )}

      {prefillEmail && (
        <div className="mb-5 rounded-lg bg-accent-soft px-4 py-3 text-[12.5px] text-[--c-accent-deep] leading-relaxed">
          🎉 招待を受け取りました。下の方法のいずれかでログインすると参加できます。
          初めての方は「✉️ ログインリンクを送る」が一番かんたんです（パスワード不要）。
        </div>
      )}

      {/* メールアドレス共通入力 */}
      <label className="block mb-4">
        <span className="t-label block mb-1">メールアドレス</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="w-full rounded-lg border border-line bg-white px-4 py-3 text-sm outline-none focus:border-[--c-accent]"
        />
      </label>

      {/* 主要動線: マジックリンク (パスワード不要) */}
      <button
        type="button"
        onClick={sendMagicLink}
        disabled={status.kind === "loading" || cooldown > 0 || !email.trim()}
        className="w-full rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition mb-3"
      >
        {cooldown > 0
          ? `⏳ あと ${formatCooldown(cooldown)} 待ってください`
          : status.kind === "loading"
            ? "..."
            : "✉️ ログインリンクを送る（パスワード不要）"}
      </button>
      <p className="t-cap text-center mb-5 opacity-75 leading-relaxed">
        メールが届くのでリンクを開くだけ。初回利用の方もこちらでアカウントが作られます。
      </p>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-line" />
        <span className="t-cap">または</span>
        <div className="flex-1 h-px bg-line" />
      </div>

      {/* Google */}
      <button
        type="button"
        onClick={signInWithGoogle}
        className="w-full flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-3 text-sm font-medium text-ink hover:bg-mute/5 transition mb-3"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.71v2.26h2.9c1.7-1.56 2.69-3.87 2.69-6.61z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.81 5.95-2.19l-2.9-2.26c-.81.55-1.84.87-3.05.87a5.27 5.27 0 0 1-4.95-3.65H1.06v2.34A9 9 0 0 0 9 18z"
          />
          <path
            fill="#FBBC05"
            d="M4.05 10.77a5.27 5.27 0 0 1 0-3.54V4.89H1.06a9 9 0 0 0 0 8.22l2.99-2.34z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.51.45 3.44 1.34l2.58-2.58A8.96 8.96 0 0 0 9 0a9 9 0 0 0-7.94 4.89l2.99 2.34A5.27 5.27 0 0 1 9 3.58z"
          />
        </svg>
        Google でログイン
      </button>

      {/* パスワード (折りたたみ) */}
      {!showPassword ? (
        <button
          type="button"
          onClick={() => setShowPassword(true)}
          className="block w-full text-center t-cap underline text-mute hover:text-ink py-2"
        >
          パスワードでログイン（設定済みの方）
        </button>
      ) : (
        <form onSubmit={signInWithPassword} className="space-y-3 mt-2">
          <label className="block">
            <span className="t-label block mb-1">パスワード</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="設定済みのパスワード"
              autoComplete="current-password"
              autoFocus
              className="w-full rounded-lg border border-line bg-white px-4 py-3 text-sm outline-none focus:border-[--c-accent]"
            />
          </label>
          <button
            type="submit"
            disabled={status.kind === "loading"}
            className="w-full rounded-lg bg-white border border-line px-4 py-3 text-sm font-semibold text-ink hover:bg-mute/5 disabled:opacity-50 transition"
          >
            {status.kind === "loading" ? "..." : "パスワードでログイン"}
          </button>
        </form>
      )}

      {status.kind === "sent" && (
        <div className="mt-5 rounded-lg bg-accent-soft px-4 py-3 text-sm text-[--c-accent-deep]">
          ✉️ メールを送信しました。受信箱のリンクをクリックしてログインを完了してください。
        </div>
      )}
      {status.kind === "error" && (
        <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {status.message}
          {status.rateLimited && (
            <div className="mt-2 t-cap text-red-700/80">
              💡 お困りの場合は「Google でログイン」をお試しください
              （メール送信制限の対象外です）。
            </div>
          )}
        </div>
      )}

      <p className="t-cap text-center mt-6 leading-relaxed">
        初回はメールリンクからログイン → 後で /マイページ でパスワードを設定できます。
      </p>
    </div>
  );
}

function formatCooldown(seconds: number): string {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}分${s}秒` : `${m}分`;
  }
  return `${seconds}秒`;
}
