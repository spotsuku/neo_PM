import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { ensurePersonalOrg } from "@/lib/orgs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next") ?? "/orgs";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=auth", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=auth", url.origin));
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
