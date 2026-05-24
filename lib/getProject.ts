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

/**
 * ダッシュボードなど「組織メンバーなら未参加でも閲覧できる」ページ用の取得。
 * 対象組織の project 行が取れれば返す (projects の SELECT RLS = is_org_member のため、
 * 組織外ユーザには行が返らず notFound)。
 * 参加/未参加 (access) の出し分け (読み取り専用にする等) は呼び出し側で行う。
 */
export async function getProjectViewableOrNotFound(
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
  return project;
}
