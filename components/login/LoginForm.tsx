"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

function jpAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return "メールアドレスかパスワードが違います。";
  }
  if (/email not confirmed/i.test(message)) {
    return "メール確認が完了していません。受信箱のリンクをクリックしてください。";
  }
  return message;
}

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") ?? "/orgs";
  const justLoggedOut = search.get("logout") === "1";

  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

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
      setStatus({ kind: "error", message: jpAuthError(error.message) });
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
    setStatus({ kind: "loading" });
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: buildRedirect() },
    });
    if (error) {
      setStatus({ kind: "error", message: jpAuthError(error.message) });
      return;
    }
    setStatus({ kind: "sent" });
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: buildRedirect() },
    });
    if (error) {
      setStatus({ kind: "error", message: jpAuthError(error.message) });
    }
  };

  return (
    <div className="glass-strong p-8 md:p-10 w-full max-w-md animate-risein">
      <div className="text-center mb-6">
        <div
          className="inline-flex h-12 w-12 items-center justify-center rounded-xl text-white font-bold text-lg mb-3"
          style={{
            background:
              "conic-gradient(from 220deg, var(--c-accent), var(--c-accent-deep) 60%, #0a0a0a)",
          }}
        >
          ✦
        </div>
        <h1 className="t-h2 mb-1">NEO PM へようこそ</h1>
        <p className="t-cap">応援資本主義のためのプロジェクトダッシュボード</p>
      </div>

      {justLoggedOut && (
        <div className="mb-5 rounded-lg bg-accent-soft px-4 py-3 text-sm text-[--c-accent-deep] text-center">
          👋 ログアウトしました
        </div>
      )}

      <button
        type="button"
        onClick={signInWithGoogle}
        className="w-full flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-3 text-sm font-medium text-ink hover:bg-mute/5 transition mb-5"
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

      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-line" />
        <span className="t-cap">または</span>
        <div className="flex-1 h-px bg-line" />
      </div>

      <form onSubmit={signInWithPassword} className="space-y-3">
        <label className="block">
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
        <label className="block">
          <span className="t-label block mb-1">パスワード</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="設定済みの方のみ"
            autoComplete="current-password"
            className="w-full rounded-lg border border-line bg-white px-4 py-3 text-sm outline-none focus:border-[--c-accent]"
          />
        </label>
        <button
          type="submit"
          disabled={status.kind === "loading"}
          className="w-full rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition"
        >
          {status.kind === "loading" ? "..." : "ログイン"}
        </button>
      </form>

      <div className="mt-5 rounded-lg border border-dashed border-line p-3 text-center">
        <p className="t-cap mb-2 leading-relaxed">
          新規の方・パスワードを忘れた方は<br />
          メールでログインリンクを受け取ってください
        </p>
        <button
          type="button"
          onClick={sendMagicLink}
          disabled={status.kind === "loading"}
          className="w-full rounded-md bg-white border border-line px-3 py-2 text-[12px] font-semibold text-mute hover:text-[--c-accent-deep] hover:border-[--c-accent] hover:bg-accent-soft transition disabled:opacity-50"
        >
          ✉️ ログインリンクを送信
        </button>
      </div>

      {status.kind === "sent" && (
        <div className="mt-5 rounded-lg bg-accent-soft px-4 py-3 text-sm text-[--c-accent-deep]">
          ✉️ メールを送信しました。受信箱のリンクをクリックしてログインを完了してください。
        </div>
      )}
      {status.kind === "error" && (
        <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {status.message}
        </div>
      )}

      <p className="t-cap text-center mt-6 leading-relaxed">
        初回はメールリンクからログインし、その後にパスワードを設定できます。
      </p>
    </div>
  );
}
