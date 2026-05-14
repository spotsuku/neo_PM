import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { pickCurrentProject } from "@/lib/projects";

export const runtime = "nodejs";

/**
 * 現在のユーザーがアクセス可能な「いま開くべきプロジェクト」を1件返す。
 * `?org=<slug>` でスコープ。`?p=<id>` で明示指定可（存在/権限はサーバ側で再検証）。
 * 結果: { project: { id, name, team_name, organization_id } | null, reason?: string }
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get("org");
  const explicit = url.searchParams.get("p");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { project: null, reason: "unauthenticated" },
      { status: 401 },
    );
  }
  if (!orgSlug) {
    return NextResponse.json({ project: null, reason: "no_org" });
  }

  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) {
    return NextResponse.json({ project: null, reason: "org_not_found" });
  }

  const project = await pickCurrentProject(supabase, org.id, explicit);
  if (!project) {
    return NextResponse.json({ project: null, reason: "no_accessible_project" });
  }

  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      team_name: project.team_name,
      organization_id: project.organization_id,
    },
  });
}
