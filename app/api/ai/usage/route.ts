import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getUsageStatus } from "@/lib/ai/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/usage?projectId=xxx
 *  今月の AI 使用額と上限を返す。UI アラート用。 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId は必須です" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未認証" }, { status: 401 });
  }

  // RLS 経由でプロジェクトへのアクセス権チェック
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) {
    return NextResponse.json(
      { error: "プロジェクトが見つかりません" },
      { status: 404 },
    );
  }

  const status = await getUsageStatus(projectId);
  return NextResponse.json(status);
}
