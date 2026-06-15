import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { ensurePersonalOrg } from "@/lib/orgs";
import type { Database } from "@/lib/types/database";

/** /auth/callback
 *  メールリンク (magic link / OAuth) からの戻り口。
 *
 *  注意: ここでは `cookies()` from "next/headers" ではなく、
 *  request.cookies / response.cookies の組み合わせで supabase クライアントを
 *  作ること。`NextResponse.redirect()` を返す Route Handler では、
 *  cookies() 経由の set は Set-Cookie ヘッダがレスポンスに乗らず、
 *  「ログインしたはずがリダイレクト後 middleware で未ログイン扱いされて
 *   /login に戻る」現象が起きるため。
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next") ?? "/orgs";
  const upstreamErr = url.searchParams.get("error");
  const upstreamErrDesc = url.searchParams.get("error_description");

  const fail = (reason: string, detail?: string | null) => {
    console.warn("[auth/callback] fail", {
      reason,
      detail,
      next: requestedNext,
    });
    const login = new URL("/login", url.origin);
    login.searchParams.set("error", reason);
    if (detail) login.searchParams.set("error_desc", detail);
    if (requestedNext) login.searchParams.set("next", requestedNext);
    return NextResponse.redirect(login);
  };

  if (upstreamErr) {
    return fail(upstreamErr, upstreamErrDesc);
  }

  if (!code) {
    return fail("no_code", "認証コードがありません");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return fail("env_missing", "Supabase 環境変数が未設定です");
  }

  // 最終的に返すレスポンス。cookies はこの response に直接書く。
  let response = NextResponse.redirect(
    new URL(requestedNext, url.origin),
  );

  const supabase = createServerClient<Database>(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return fail("exchange_failed", error.message);
  }

  await ensurePersonalOrg(supabase).catch((e) => {
    console.warn("ensurePersonalOrg failed", e);
  });

  // パスワード未設定なら /welcome に誘導 (Google OAuth ユーザーや一度
  // スキップした人はスキップ)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const hasPassword = meta.has_password === true;
  const skipped = meta.password_prompt_skipped === true;
  const hasOAuth = (user?.identities ?? []).some(
    (i) => i.provider !== "email",
  );

  if (user && !hasPassword && !skipped && !hasOAuth) {
    const welcome = new URL("/welcome", url.origin);
    welcome.searchParams.set("next", requestedNext);
    // 既存 response に書かれた cookie を引き継いで redirect 先だけ差し替え
    const next = NextResponse.redirect(welcome);
    response.cookies.getAll().forEach((c) => {
      next.cookies.set(c);
    });
    return next;
  }

  return response;
}
