import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

type Client = SupabaseClient<Database>;
type Project = Database["public"]["Tables"]["projects"]["Row"];

/**
 * 指定組織で「いま開くべきプロジェクト」を1件返す。
 * 優先順: explicit projectId → active で updated_at が新しい → そうでなければ最新 → なければ null
 */
export async function pickCurrentProject(
  supabase: Client,
  orgId: string,
  explicitProjectId?: string | null,
): Promise<Project | null> {
  if (explicitProjectId) {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("organization_id", orgId)
      .eq("id", explicitProjectId)
      .maybeSingle();
    if (data) return data;
  }
  const { data: active } = await supabase
    .from("projects")
    .select("*")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (active) return active;

  const { data: anyP } = await supabase
    .from("projects")
    .select("*")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return anyP ?? null;
}

export async function listOrgProjects(supabase: Client, orgId: string) {
  const { data } = await supabase
    .from("projects")
    .select("id, name, team_name, status, progress_pct, updated_at")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false });
  return data ?? [];
}
