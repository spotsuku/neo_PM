"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

interface Props {
  token: string;
  intendedName: string | null;
  /** 匿名サインインが Supabase 側で無効な場合の救済導線 */
  loginFallbackHref: string;
}

/** ログイン不要で招待を受諾するボタン。
 *  Supabase Anonymous Sign-In を使って、未ログインなら自動でゲストアカウントを
 *  作成 → そのまま redeem_invitation を実行 → 組織にジャンプ。 */
export function AnonymousJoinButton({
  token,
  intendedName,
  loginFallbackHref,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const requiresConfirm = Boolean(intendedName);
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "error"; message: string; needsLogin?: boolean }
  >({ kind: "idle" });

  const join = async () => {
    setStatus({ kind: "loading" });

    // 既にログイン済かチェック (例: タブで /login 経由したケース)
    const {
      data: { user: existingUser },
    } = await supabase.auth.getUser();

    if (!existingUser) {
      // ゲストとして匿名サインイン
      const { error: anonErr } = await supabase.auth.signInAnonymously();
      if (anonErr) {
        // Anonymous Sign-In が無効化されているケース etc.
        setStatus({
          kind: "error",
          message:
            "ゲスト参加が現在無効化されています。ログインからお進みください。",
          needsLogin: true,
        });
        return;
      }
    }

    // 招待を消費 → 組織に参加
    const { data, error } = await supabase.rpc("redeem_invitation", {
      p_token: token,
    });
    if (error) {
      const msg = error.message.includes("already_used")
        ? "この招待は既に使われています"
        : error.message.includes("expired")
          ? "この招待は期限切れです"
          : error.message.includes("invalid_token")
            ? "招待が見つかりませんでした"
            : error.message.includes("email_mismatch")
              ? "この招待は別のメールアドレス宛です。ログインからお進みください。"
              : error.message;
      setStatus({ kind: "error", message: msg });
      return;
    }
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) {
      setStatus({ kind: "error", message: "予期せぬエラーが発生しました" });
      return;
    }
    if (row.project_id) {
      router.push(`/${row.org_slug}/dashboard?p=${row.project_id}`);
    } else {
      router.push(`/${row.org_slug}`);
    }
    router.refresh();
  };

  return (
    <div>
      {requiresConfirm && (
        <label className="mb-3 flex items-start gap-2 text-left rounded-lg border border-warn/40 bg-warn/5 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 accent-[--c-accent]"
          />
          <span className="text-[12.5px] leading-relaxed">
            私は <strong>{intendedName}</strong> 本人です。
            <span className="block t-cap mt-0.5 opacity-80">
              他の人のリンクを間違えて踏んだ場合は、チェックせずページを閉じてください。
            </span>
          </span>
        </label>
      )}

      <button
        type="button"
        onClick={join}
        disabled={
          status.kind === "loading" || (requiresConfirm && !confirmed)
        }
        className="block w-full rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {status.kind === "loading" ? "..." : "✦ 参加する"}
      </button>

      {status.kind === "error" && (
        <div className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 text-left">
          {status.message}
          {status.needsLogin && (
            <a
              href={loginFallbackHref}
              className="block mt-2 underline font-semibold"
            >
              → ログインに進む
            </a>
          )}
        </div>
      )}
      <p className="t-cap mt-3 opacity-70 leading-relaxed">
        メアドやパスワードの設定なしで参加できます。
        マイページから後でログイン手段を登録できます。
      </p>
    </div>
  );
}
