import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { ensurePersonalOrg } from "@/lib/orgs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next") ?? "/orgs";
  // Supabase auth (verify endpoint) もエラー時にこれらを付ける
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

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return fail("exchange_failed", error.message);
  }

  // 初回サインインなら個人組織を自動作成（trigger 経由でも作られるが二重防御）
  await ensurePersonalOrg(supabase).catch((e) => {
    console.warn("ensurePersonalOrg failed", e);
  });

  // パスワード未設定なら /welcome に誘導（Google OAuth ユーザーや一度スキップした人はスキップ）
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
    return NextResponse.redirect(welcome);
  }

  return NextResponse.redirect(new URL(requestedNext, url.origin));
}
