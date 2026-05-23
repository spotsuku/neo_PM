import { notFound } from "next/navigation";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { getMyProjectAccess } from "@/lib/projects";

type Client = SupabaseClient<Database>;
type Project = Database["public"]["Tables"]["projects"]["Row"];

/**
 * パスパラメータで指定された projectId が対象組織に属し、
 * かつ現在ユーザがアクセス可能かを検証する。
 *
 * - project が無い、別 org の project のいずれかなら notFound()
 * - 参加していない (access === "none") プロジェクトも notFound()
 *   → 組織メンバーであっても、未参加プロジェクトの中身は URL 直打ちでも見えない。
 *     メンバー視点プレビュー中は管理者特権を外して判定する。
 * - そうでなければ Project 行を返す
 */
export async function getProjectForOrgOrNotFound(
  supabase: Client,
  orgId: string,
  projectId: string,
): Promise<Project> {
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!project) notFound();

  const access = await getMyProjectAccess(supabase, orgId, projectId);
  if (access === "none") notFound();

  return project;
}
