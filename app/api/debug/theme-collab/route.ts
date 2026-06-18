import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";

/** デバッグ用エンドポイント。 原因切り分け用、用が済んだら削除。
 *
 *  使い方:
 *  - `/api/debug/theme-collab` → ログインしてる自分の SSR 状態を JSON で
 *  - `/api/debug/theme-collab?email=foo@bar.com` → 管理者が他ユーザーの
 *    DB 上の状態を覗く (RLS バイパスで service role 使用)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const targetEmail = url.searchParams.get("email");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // パターン B: 管理者が他ユーザーの状態を覗くモード (service role で RLS バイパス)
  if (targetEmail) {
    if (!user) {
      return NextResponse.json(
        { error: "認証必須" },
        { status: 401 },
      );
    }
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceKey || !dbUrl) {
      return NextResponse.json(
        { error: "SERVICE_ROLE_KEY 未設定" },
        { status: 500 },
      );
    }
    const admin = createSupabaseClient<Database>(dbUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // (1) 対象ユーザーを email で検索
    const { data: target } = await admin
      .from("profiles")
      .select("id, display_name")
      .order("created_at", { ascending: false })
      .limit(1000);
    // profiles に email が無いので auth.users から引きたいが client 経由は難しい
    // 仕方ないので raw SQL 風に rpc 使用 ── ではなく直接 SQL を実行する仕組み
    // (現状は profiles 一覧返すだけ。email→id は SQL editor 側で確認してもらう)

    // shortcut: SERVICE ROLE で auth.users を引く
    const { data: authUsers } = (await admin
      .schema("auth" as never)
      .from("users")
      .select("id, email")
      .eq("email", targetEmail)
      .maybeSingle()) as { data: { id: string; email: string } | null };

    const targetId = authUsers?.id ?? null;

    if (!targetId) {
      return NextResponse.json({
        mode: "inspect_user",
        target_email: targetEmail,
        target_id: null,
        error: "対象ユーザーが見つかりません (auth.users にこの email 無し)",
        debug_profile_sample: target?.slice(0, 3),
      });
    }

    const themeId = "440196b4-2e47-46b4-b5dd-c77bb4e8fe26";

    const { data: collabRows } = await admin
      .from("theme_collaborators")
      .select("theme_id, role")
      .eq("user_id", targetId);

    const { data: memberships } = await admin
      .from("memberships")
      .select("organization_id, role")
      .eq("user_id", targetId);

    const { data: themeRow } = await admin
      .from("themes")
      .select("id, title, posted_by, status, organization_id")
      .eq("id", themeId)
      .maybeSingle();

    return NextResponse.json({
      mode: "inspect_user (service_role bypass)",
      target_email: targetEmail,
      target_id: targetId,
      collab_rows: collabRows,
      memberships,
      theme: themeRow,
    });
  }

  // パターン A: 自分自身の SSR 状態
  const result: Record<string, unknown> = {
    mode: "self (SSR with RLS)",
    timestamp: new Date().toISOString(),
    user_id: user?.id ?? null,
    user_email: user?.email ?? null,
  };

  if (!user) {
    return NextResponse.json(result);
  }

  const { data: collabRows, error: collabErr } = await supabase
    .from("theme_collaborators")
    .select("theme_id, role, user_id")
    .eq("user_id", user.id);
  result.collab_rows = collabRows;
  result.collab_err = collabErr?.message ?? null;

  const themeId = "440196b4-2e47-46b4-b5dd-c77bb4e8fe26";
  const { data: themeRow, error: themeErr } = await supabase
    .from("themes")
    .select("id, title, posted_by, status")
    .eq("id", themeId)
    .maybeSingle();
  result.theme_select = themeRow;
  result.theme_err = themeErr?.message ?? null;

  const { data: memberships } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", user.id);
  result.memberships = memberships;

  return NextResponse.json(result);
}
