import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** デバッグ用: サーバから見た認証コンテキストを返す */
export async function GET() {
  const supabase = await createClient();
  const { data: u, error: ue } = await supabase.auth.getUser();
  // 認証済みなら organizations を読めるはず (RLS: is_org_member 経由)
  const probe = await supabase
    .from("memberships")
    .select("organization_id, role")
    .limit(5);
  return NextResponse.json({
    sdk_user_id: u.user?.id ?? null,
    sdk_email: u.user?.email ?? null,
    sdk_error: ue?.message ?? null,
    memberships_visible_count: probe.data?.length ?? 0,
    memberships_error: probe.error?.message ?? null,
  });
}
