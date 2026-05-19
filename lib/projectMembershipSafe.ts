import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

type Client = SupabaseClient<Database>;

export interface SafeProjectMember {
  id: string;
  user_id: string;
  role: "lead" | "member";
  title: string | null;
  responsibility: string | null;
  work_description: string | null;
  created_at: string;
}

export interface SafeFetchResult {
  members: SafeProjectMember[];
  /** migration 0025 が未適用で responsibility/work_description が無い時 true */
  legacySchema: boolean;
  error: string | null;
}

/** project_memberships を SELECT する。
 *  migration 0025 (responsibility/work_description) が未適用の本番 DB でも
 *  落ちずに動くよう、fallback で safe column set を再試行する。 */
export async function fetchProjectMembersSafe(
  supabase: Client,
  projectId: string,
): Promise<SafeFetchResult> {
  // 1) full schema を試す
  const full = await supabase
    .from("project_memberships")
    .select(
      "id, user_id, role, title, responsibility, work_description, created_at",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (!full.error) {
    return {
      members: (full.data ?? []).map((m) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role as "lead" | "member",
        title: m.title,
        responsibility: m.responsibility,
        work_description: m.work_description,
        created_at: m.created_at,
      })),
      legacySchema: false,
      error: null,
    };
  }

  // 2) 'does not exist' エラーなら legacy schema として安全な列だけで再試行
  const msg = full.error.message || "";
  if (
    msg.includes("does not exist") &&
    (msg.includes("responsibility") || msg.includes("work_description"))
  ) {
    const safe = await supabase
      .from("project_memberships")
      .select("id, user_id, role, title, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (safe.error) {
      return { members: [], legacySchema: true, error: safe.error.message };
    }
    return {
      members: (safe.data ?? []).map((m) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role as "lead" | "member",
        title: m.title,
        responsibility: null,
        work_description: null,
        created_at: m.created_at,
      })),
      legacySchema: true,
      error: null,
    };
  }

  // 3) その他のエラーは素直に返す
  return { members: [], legacySchema: false, error: full.error.message };
}
