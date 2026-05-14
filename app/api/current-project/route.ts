import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * 現在のユーザーがアクセス可能な「最新のアクティブプロジェクト」を返す。
 * orgSlug クエリでスコープを限定可能。
 * 結果: { project: { id, name, organization_id } | null }
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get("org");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ project: null }, { status: 401 });
  }

  let orgId: string | null = null;
  if (orgSlug) {
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", orgSlug)
      .maybeSingle();
    orgId = org?.id ?? null;
  }

  // 組織 admin/owner なら active project から最新を返す
  // 一般メンバーは project_memberships に紐づくものから
  let projectId: string | null = null;

  if (orgId) {
    const { data: m } = await supabase
      .from("memberships")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    const isAdmin = m?.role === "owner" || m?.role === "admin";

    if (isAdmin) {
      const { data } = await supabase
        .from("projects")
        .select("id")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      projectId = data?.id ?? null;
    } else {
      const { data: pms } = await supabase
        .from("project_memberships")
        .select("project_id")
        .eq("user_id", user.id);
      const ids = (pms ?? []).map((p) => p.project_id);
      if (ids.length > 0) {
        const { data } = await supabase
          .from("projects")
          .select("id")
          .eq("organization_id", orgId)
          .in("id", ids)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        projectId = data?.id ?? null;
      }
    }
  }

  if (!projectId) {
    return NextResponse.json({ project: null });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, team_name, organization_id")
    .eq("id", projectId)
    .maybeSingle();

  return NextResponse.json({ project });
}
