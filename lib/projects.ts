import { cookies } from "next/headers";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

type Client = SupabaseClient<Database>;
type Project = Database["public"]["Tables"]["projects"]["Row"];

export type ProjectAccess = "manage" | "view" | "none";

export interface ProjectListItem {
  id: string;
  name: string;
  team_name: string | null;
  status: "active" | "paused" | "completed" | "archived";
  progress_pct: number;
  updated_at: string;
  thumbnail_url: string | null;
  is_demo: boolean;
  access: ProjectAccess;
}

/**
 * 「メンバー視点 / テーマオーナー視点プレビュー」中かどうか。
 * 管理者がプレビュー cookie を立てている間は、プロジェクトのアクセス判定でも
 * 管理者特権を外し、実際に参加している (lead/member) プロジェクトだけを
 * アクセス可能として扱う。
 */
async function previewDemotesAdmin(): Promise<boolean> {
  try {
    const store = await cookies();
    const v = store.get("neo:view-as")?.value;
    return v === "member" || v === "theme_owner";
  } catch {
    return false;
  }
}

/**
 * 指定組織の current ユーザーの role / 各プロジェクトへのアクセス権を1往復で取得。
 * demoteAdmin=true のときは管理者特権を外す (メンバー視点プレビューの一覧表示用)。
 */
async function fetchAccessContext(
  supabase: Client,
  orgId: string,
  demoteAdmin = false,
): Promise<{
  isOrgAdmin: boolean;
  leadOf: Set<string>;
  memberOf: Set<string>;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  const { data: my } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", userId ?? "")
    .maybeSingle();
  const realAdmin = my?.role === "owner" || my?.role === "admin";
  const isOrgAdmin = realAdmin && !demoteAdmin;

  const { data: pms } = await supabase
    .from("project_memberships")
    .select("project_id, role")
    .eq("user_id", userId ?? "");

  const leadOf = new Set<string>();
  const memberOf = new Set<string>();
  for (const pm of pms ?? []) {
    if (pm.role === "lead") leadOf.add(pm.project_id);
    else memberOf.add(pm.project_id);
  }

  return { isOrgAdmin, leadOf, memberOf };
}

function classify(
  projectId: string,
  ctx: Awaited<ReturnType<typeof fetchAccessContext>>,
): ProjectAccess {
  if (ctx.isOrgAdmin) return "manage";
  if (ctx.leadOf.has(projectId)) return "manage";
  if (ctx.memberOf.has(projectId)) return "view";
  return "none";
}

/**
 * current ユーザーの指定プロジェクトへのアクセス権を返す。
 * タブのゲート判定 (guardProjectTab) 用途。
 * メンバー視点プレビュー中は管理者特権を降格する (previewDemotesAdmin)。
 * これにより、プレビュー中の管理者が未参加プロジェクトのタブを開くと、
 * 実メンバーと同じく「参加すると閲覧できます」ゲートが表示される。
 * (実メンバー(非管理者)は cookie の有無に関わらず未参加プロジェクトは "none")
 */
export async function getMyProjectAccess(
  supabase: Client,
  orgId: string,
  projectId: string,
): Promise<ProjectAccess> {
  const ctx = await fetchAccessContext(supabase, orgId, await previewDemotesAdmin());
  return classify(projectId, ctx);
}

/**
 * 「いま開くべきプロジェクト」を1件返す（current ユーザーがアクセス可能なもののみ）。
 * 優先順:
 *   1. explicitProjectId が指定 & アクセス可
 *   2. アクセス可な active で最新更新
 *   3. アクセス可ななんでも最新更新
 *   4. null
 */
export async function pickCurrentProject(
  supabase: Client,
  orgId: string,
  explicitProjectId?: string | null,
): Promise<Project | null> {
  const ctx = await fetchAccessContext(supabase, orgId, await previewDemotesAdmin());

  // 明示指定: 念のため取得してアクセス可かチェック
  if (explicitProjectId) {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("organization_id", orgId)
      .eq("id", explicitProjectId)
      .maybeSingle();
    if (data && classify(data.id, ctx) !== "none") return data;
  }

  // アクセス可な active から最新
  const { data: active } = await supabase
    .from("projects")
    .select("*")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(20);
  for (const p of active ?? []) {
    if (classify(p.id, ctx) !== "none") return p;
  }

  // アクセス可ななんでも
  const { data: anyP } = await supabase
    .from("projects")
    .select("*")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(20);
  for (const p of anyP ?? []) {
    if (classify(p.id, ctx) !== "none") return p;
  }

  return null;
}

/** ランキング表示用: 組織内の全プロジェクトを access 情報付きで返す */
export async function listOrgProjects(
  supabase: Client,
  orgId: string,
): Promise<ProjectListItem[]> {
  const ctx = await fetchAccessContext(supabase, orgId, await previewDemotesAdmin());

  const { data } = await supabase
    .from("projects")
    .select(
      "id, name, team_name, status, progress_pct, updated_at, thumbnail_url, is_demo",
    )
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false });

  return (data ?? []).map((p) => ({
    ...p,
    status: p.status as ProjectListItem["status"],
    access: classify(p.id, ctx),
  }));
}

/** ProjectPicker などで使う: アクセス可なプロジェクトだけ */
export async function listAccessibleProjects(
  supabase: Client,
  orgId: string,
): Promise<ProjectListItem[]> {
  const all = await listOrgProjects(supabase, orgId);
  return all.filter((p) => p.access !== "none");
}
