import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/** デバッグ用エンドポイント。本番で /api/debug/theme-collab を叩くと
 *  SSR の auth context と theme_collaborators / themes クエリ結果を JSON で返す。
 *  原因切り分け用、用が済んだら削除。 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    user_id: user?.id ?? null,
    user_email: user?.email ?? null,
    user_err: userErr?.message ?? null,
  };

  if (!user) {
    return NextResponse.json(result);
  }

  // (1) SSR から theme_collaborators を取得
  const { data: collabRows, error: collabErr } = await supabase
    .from("theme_collaborators")
    .select("theme_id, role, user_id")
    .eq("user_id", user.id);
  result.collab_rows = collabRows;
  result.collab_err = collabErr?.message ?? null;

  // (2) themes 単発 SELECT (OHASHI HILL)
  const themeId = "440196b4-2e47-46b4-b5dd-c77bb4e8fe26";
  const { data: themeRow, error: themeErr } = await supabase
    .from("themes")
    .select("id, title, posted_by, status")
    .eq("id", themeId)
    .maybeSingle();
  result.theme_select = themeRow;
  result.theme_err = themeErr?.message ?? null;

  // (3) memberships 確認 (org メンバーシップ)
  const { data: memberships } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", user.id);
  result.memberships = memberships;

  return NextResponse.json(result);
}
