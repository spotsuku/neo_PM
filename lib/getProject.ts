import { notFound } from "next/navigation";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

type Client = SupabaseClient<Database>;
type Project = Database["public"]["Tables"]["projects"]["Row"];

/**
 * パスパラメータで指定された projectId が対象組織に属し、
 * かつ現在ユーザがアクセス可能かを検証する。
 *
 * - project が無い、別 org の project、未参加プロジェクトのいずれかなら notFound()
 * - そうでなければ Project 行をそのまま返す
 *
 * RLS により、is_org_member(org_id) を満たさないユーザは select で行が返らない。
 * その時点で notFound 扱い。
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
  return project;
}
