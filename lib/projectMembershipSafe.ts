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
  is_budget_approver: boolean;
  created_at: string;
}

export interface SafeFetchResult {
  members: SafeProjectMember[];
  /** migration 0025 が未適用で responsibility/work_description が無い時 true */
  legacySchema: boolean;
  error: string | null;
}

/** project_memberships を SELECT する。
 *  migration 0025 (responsibility/work_description) や 0054 (is_budget_approver)
 *  が未適用の DB でも落ちないよう、欠けている列に応じて段階的に縮退する。
 *  - 0054 だけ未適用: responsibility 等は維持し is_budget_approver=false (legacySchema=false)
 *  - 0025 未適用: responsibility/work_description が無い legacy schema (legacySchema=true) */
export async function fetchProjectMembersSafe(
  supabase: Client,
  projectId: string,
): Promise<SafeFetchResult> {
  // 1) full schema を試す
  const full = await supabase
    .from("project_memberships")
    .select(
      "id, user_id, role, title, responsibility, work_description, is_budget_approver, created_at",
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
        is_budget_approver: m.is_budget_approver ?? false,
        created_at: m.created_at,
      })),
      legacySchema: false,
      error: null,
    };
  }

  const msg = full.error.message || "";
  const missing = (col: string) =>
    msg.includes("does not exist") && msg.includes(col);

  // 2) 0054 のみ未適用 (is_budget_approver が無いが responsibility 系はある):
  //    責任 / 業務内容は維持し、is_budget_approver=false で縮退 (legacySchema=false)
  if (
    missing("is_budget_approver") &&
    !missing("responsibility") &&
    !missing("work_description")
  ) {
    const noApprover = await supabase
      .from("project_memberships")
      .select(
        "id, user_id, role, title, responsibility, work_description, created_at",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (!noApprover.error) {
      return {
        members: (noApprover.data ?? []).map((m) => ({
          id: m.id,
          user_id: m.user_id,
          role: m.role as "lead" | "member",
          title: m.title,
          responsibility: m.responsibility,
          work_description: m.work_description,
          is_budget_approver: false,
          created_at: m.created_at,
        })),
        legacySchema: false,
        error: null,
      };
    }
  }

  // 3) 0025 未適用 (responsibility/work_description が無い): legacy schema
  if (missing("responsibility") || missing("work_description")) {
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
        is_budget_approver: false,
        created_at: m.created_at,
      })),
      legacySchema: true,
      error: null,
    };
  }

  // 4) その他のエラーは素直に返す
  return { members: [], legacySchema: false, error: full.error.message };
}
