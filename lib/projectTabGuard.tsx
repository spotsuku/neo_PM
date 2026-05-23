import type { ReactElement } from "react";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { getProjectViewableOrNotFound } from "@/lib/getProject";
import { getMyProjectAccess } from "@/lib/projects";
import { ProjectJoinGate } from "@/components/projects/ProjectJoinGate";

type Client = SupabaseClient<Database>;
type Project = Database["public"]["Tables"]["projects"]["Row"];

/**
 * プロジェクトの「ダッシュボード以外」のタブ用ガード。
 * - 組織外 / 存在しない → notFound (getProjectViewableOrNotFound)
 * - 組織メンバーだが未参加 (access=none) → gate (「参加すると閲覧できます」案内) を返す
 * - 参加者 or 組織admin → gate=null。ページは current を使って通常描画
 *
 * 使い方:
 *   const { current, gate } = await guardProjectTab(supabase, org.id, projectId, orgSlug, "WBS");
 *   if (gate) return gate;
 */
export async function guardProjectTab(
  supabase: Client,
  orgId: string,
  projectId: string,
  orgSlug: string,
  tabLabel: string,
): Promise<{ current: Project; gate: ReactElement | null }> {
  const current = await getProjectViewableOrNotFound(supabase, orgId, projectId);
  const access = await getMyProjectAccess(supabase, orgId, projectId);
  if (access === "none") {
    return {
      current,
      gate: (
        <ProjectJoinGate
          orgSlug={orgSlug}
          projectId={projectId}
          projectName={current.name}
          tabLabel={tabLabel}
        />
      ),
    };
  }
  return { current, gate: null };
}
