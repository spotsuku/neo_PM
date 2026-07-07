import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";

export const runtime = "nodejs";

/**
 * POST /api/orgs/[slug]/join
 *
 * community_dashboard で認証済みのユーザだけが、そのフラグに一致する組織 (slug)
 * にメンバーとして参加できる。
 *
 * 認可条件:
 *   1. AI PM にログイン済み
 *   2. user_metadata.community_verified === true
 *   3. user_metadata.community_invited_org_slug === params.slug
 *
 * 上記を満たすときのみ service-role で memberships を insert する。
 * 既にメンバーなら no-op で 200 を返す。
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const verified = meta.community_verified === true;
  const invitedSlug =
    typeof meta.community_invited_org_slug === "string"
      ? meta.community_invited_org_slug
      : null;

  if (!verified || invitedSlug !== slug) {
    return NextResponse.json(
      {
        error:
          "この組織に参加するには community_dashboard での認証が必要です。ログイン画面から「コミュニティポータルでログイン」を選んでください。",
      },
      { status: 403 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "サーバ設定不足 (SUPABASE_SERVICE_ROLE_KEY 未設定)" },
      { status: 500 },
    );
  }

  const admin = createSupabaseClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();
  if (orgErr || !org) {
    return NextResponse.json(
      { error: orgErr?.message ?? "組織が見つかりません" },
      { status: 404 },
    );
  }

  // 既存 membership 確認
  const { data: existing } = await admin
    .from("memberships")
    .select("id")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, alreadyMember: true, slug: org.slug });
  }

  const { error: memErr } = await admin.from("memberships").insert({
    user_id: user.id,
    organization_id: org.id,
    role: "member",
  } as never);
  if (memErr) {
    return NextResponse.json(
      { error: `参加に失敗しました: ${memErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, alreadyMember: false, slug: org.slug });
}
