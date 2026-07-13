import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** デバッグ用: サーバから見た認証コンテキストを返す */
export async function GET() {
  const supabase = await createClient();
  const { data: u, error: ue } = await supabase.auth.getUser();
  // 認証済みなら organizations を読めるはず (RLS: is_org_member 経由)
  const probe = await supabase
    .from("memberships")
    .select("organization_id, role")
    .limit(5);
  const meta = (u.user?.user_metadata ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    sdk_user_id: u.user?.id ?? null,
    sdk_email: u.user?.email ?? null,
    sdk_error: ue?.message ?? null,
    memberships_visible_count: probe.data?.length ?? 0,
    memberships_error: probe.error?.message ?? null,
    // community login 診断用: metadata と env var の設定状態
    community: {
      metadata: {
        community_verified: meta.community_verified ?? null,
        community_verified_at: meta.community_verified_at ?? null,
        community_invited_org_slug: meta.community_invited_org_slug ?? null,
        community_cohort_ids: meta.community_cohort_ids ?? null,
        community_cohort_ok: meta.community_cohort_ok ?? null,
        community_profile: meta.community_profile ?? null,
        community_raw_me: meta.community_raw_me ?? null,
      },
      env: {
        NEO_COMMUNITY_ORG_SLUG:
          process.env.NEO_COMMUNITY_ORG_SLUG?.trim() || null,
        NEO_COMMUNITY_REQUIRED_COHORT_ID:
          process.env.NEO_COMMUNITY_REQUIRED_COHORT_ID?.trim() || null,
        NEXT_PUBLIC_COMMUNITY_CLIENT_ID_set: !!process.env
          .NEXT_PUBLIC_COMMUNITY_CLIENT_ID,
        COMMUNITY_CLIENT_SECRET_set: !!process.env.COMMUNITY_CLIENT_SECRET,
        SUPABASE_SERVICE_ROLE_KEY_set: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    },
  });
}
