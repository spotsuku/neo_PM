import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { pickCurrentProject } from "@/lib/projects";

type Client = SupabaseClient<Database>;

const LAST_PROJECT_COOKIE = "neo:last-project-id";

/**
 * 旧 URL `/[orgSlug]/<feature>?p=<projectId>` から新 URL
 * `/[orgSlug]/projects/<projectId>/<feature>` へ恒久的に redirect する。
 *
 * 旧 URL を直接踏んだ / ブックマークしたユーザを救済するための関数。
 * - `?p=` があればその ID をそのまま使う
 * - 無ければ cookie → 最新 active project の順で fallback
 * - どれも該当が無ければ /[orgSlug] (org トップ) に redirect
 */
export async function redirectToProjectScope(
  supabase: Client,
  org: { id: string; slug: string },
  explicitProjectId: string | null,
  feature: string,
  trailingSegments: string = "",
): Promise<never> {
  let projectId = explicitProjectId;

  if (!projectId) {
    const cookieStore = await cookies();
    const cookieId = cookieStore.get(
      `${LAST_PROJECT_COOKIE}:${org.slug}`,
    )?.value;
    if (cookieId) {
      const verified = await pickCurrentProject(supabase, org.id, cookieId);
      if (verified) projectId = verified.id;
    }
  }

  if (!projectId) {
    const fallback = await pickCurrentProject(supabase, org.id, null);
    if (fallback) projectId = fallback.id;
  }

  if (!projectId) {
    // プロジェクトが 1 つも無ければ org トップへ
    redirect(`/${org.slug}`);
  }

  const tail = trailingSegments ? `/${trailingSegments}` : "";
  redirect(`/${org.slug}/projects/${projectId}/${feature}${tail}`);
  // unreachable — redirect throws
  notFound();
}
