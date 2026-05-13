"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

interface Props {
  displayName: string;
  nextPath: string;
}

export function SetPasswordForm({ displayName, nextPath }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const setPwd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setStatus({
        kind: "error",
        message: "パスワードは 8 文字以上で設定してください。",
      });
      return;
    }
    if (password !== confirm) {
      setStatus({
        kind: "error",
        message: "確認用パスワードが一致しません。",
      });
      return;
    }
    setStatus({ kind: "loading" });
    const { error } = await supabase.auth.updateUser({
      password,
      data: { has_password: true },
    });
    if (error) {
      setStatus({ kind: "error", message: error.message });
      return;
    }
    router.push(nextPath);
    router.refresh();
  };

  const skip = async () => {
    setStatus({ kind: "loading" });
    await supabase.auth.updateUser({
      data: { password_prompt_skipped: true },
    });
    router.push(nextPath);
    router.refresh();
  };

  return (
    <div className="glass-strong p-8 md:p-10 w-full max-w-md animate-risein">
      <div className="text-center mb-6">
        <div className="text-4xl mb-3" aria-hidden>
          🎉
        </div>
        <h1 className="t-h2 mb-1">ようこそ、{displayName} さん</h1>
        <p className="t-cap leading-relaxed">
          次回からのログインを早くするためにパスワードを設定しましょう。
          <br />
          もちろん、いつでもメールリンクでログインできます。
        </p>
      </div>

      <form onSubmit={setPwd} className="space-y-3 mb-4">
        <label className="block">
          <span className="t-label block mb-1">新しいパスワード（8文字以上）</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-lg border border-line bg-white px-4 py-3 text-sm outline-none focus:border-[--c-accent]"
          />
        </label>
        <label className="block">
          <span className="t-label block mb-1">確認のためもう一度</span>
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-lg border border-line bg-white px-4 py-3 text-sm outline-none focus:border-[--c-accent]"
          />
        </label>
        <button
          type="submit"
          disabled={status.kind === "loading"}
          className="w-full rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition"
        >
          {status.kind === "loading" ? "..." : "✦ パスワードを設定して続行"}
        </button>
      </form>

      <button
        type="button"
        onClick={skip}
        disabled={status.kind === "loading"}
        className="w-full text-center text-[12px] text-mute hover:text-ink underline underline-offset-2 transition disabled:opacity-50"
      >
        あとで設定する
      </button>

      {status.kind === "error" && (
        <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {status.message}
        </div>
      )}
    </div>
  );
}
