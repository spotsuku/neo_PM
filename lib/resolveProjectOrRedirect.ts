import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { pickCurrentProject } from "@/lib/projects";

type Client = SupabaseClient<Database>;

const LAST_PROJECT_COOKIE = "neo:last-project-id";

/**
 * プロジェクトスコープのページで使う「現在プロジェクト」決定ロジック。
 *
 * URL の ?p= が無い場合、layout が使うのと同じ cookie ベースの fallback を
 * 採用してから redirect することで、サイドバー / ヘッダー / コンテンツが
 * 必ず同じプロジェクトを指すように揃える。
 *
 * 優先順:
 *   1. URL の ?p=  (明示指定があれば最優先)
 *   2. cookie neo:last-project-id:<orgSlug>  (前回踏んだプロジェクト)
 *   3. pickCurrentProject の "最新 active" fallback
 *
 * 値が確定したら、URL に ?p= が無ければ canonical URL に redirect する
 * (`/<orgSlug>/<path>?p=<projectId>`)。これで以降の遷移は URL に
 * 必ず ?p= が乗り、フォールバック分岐の食い違いが発生しない。
 *
 * 戻り値: 確定したプロジェクト or null (アクセス可能なプロジェクトが無い)
 */
export async function resolveProjectOrRedirect(
  supabase: Client,
  org: { id: string; slug: string },
  explicitProjectId: string | null,
  /** 例: "meetings", "plan", "wbs", "budget", "dashboard", "diag", "fund", "ai" */
  pathSegment: string,
) {
  // 1. URL ?p= が明示されていればそれを尊重 (project 単体取得して access チェック)
  if (explicitProjectId) {
    const proj = await pickCurrentProject(supabase, org.id, explicitProjectId);
    if (proj && proj.id === explicitProjectId) return proj;
    // URL の ?p= が不正 → cookie/fallback ロジックへフォールスルー
  }

  // 2. cookie の前回プロジェクト
  const cookieStore = await cookies();
  const cookieId = cookieStore.get(
    `${LAST_PROJECT_COOKIE}:${org.slug}`,
  )?.value;
  if (cookieId) {
    const proj = await pickCurrentProject(supabase, org.id, cookieId);
    if (proj && proj.id === cookieId) {
      redirect(`/${org.slug}/${pathSegment}?p=${proj.id}`);
    }
  }

  // 3. pickCurrentProject の "最新 active" fallback
  const fallback = await pickCurrentProject(supabase, org.id, null);
  if (fallback) {
    redirect(`/${org.slug}/${pathSegment}?p=${fallback.id}`);
  }

  return null;
}
