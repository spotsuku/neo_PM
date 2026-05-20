import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";

export const runtime = "nodejs";

interface Body {
  name: string;
  slug: string;
  competition_enabled?: boolean;
}

/** サーバサイドで組織を作成。
 *  - まず通常のサーバクライアントで auth.getUser() を実行してユーザを検証
 *  - 組織作成は SERVICE_ROLE クライアントで RLS をバイパス (検証済みなので安全)
 *  - memberships(owner) も同様に挿入
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: ue,
  } = await supabase.auth.getUser();
  if (ue || !user) {
    return NextResponse.json(
      {
        error: "ログインが必要です (auth session 取得失敗)",
        debug: { auth_error: ue?.message ?? "no user" },
      },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Partial<Body>;
  const name = (body.name ?? "").trim();
  const slug = (body.slug ?? "").trim();
  if (!name || !slug) {
    return NextResponse.json(
      { error: "name と slug は必須です" },
      { status: 400 },
    );
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: "slug は英小文字 / 数字 / ハイフンのみ使えます" },
      { status: 400 },
    );
  }

  // SERVICE_ROLE がある場合は RLS をバイパスして確実に作成
  // (auth.uid() の cookie 不整合で organizations.INSERT が拒否されるケース対策)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const useServiceRole = !!(serviceKey && url);

  const writer = useServiceRole
    ? createSupabaseClient<Database>(url!, serviceKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : supabase;

  const { data: org, error: orgErr } = await writer
    .from("organizations")
    .insert({
      name,
      slug,
      competition_enabled: body.competition_enabled ?? false,
    })
    .select()
    .single();
  if (orgErr || !org) {
    if (orgErr?.message?.includes("duplicate key")) {
      return NextResponse.json(
        {
          error: `スラッグ「${slug}」は既に使われています。別の slug を指定してください。`,
        },
        { status: 409 },
      );
    }
    if (
      orgErr?.message?.includes("row-level security") ||
      orgErr?.message?.includes("violates row-level security")
    ) {
      return NextResponse.json(
        {
          error: useServiceRole
            ? "RLS バイパスが効かない異常事態。SUPABASE_SERVICE_ROLE_KEY が正しいか Vercel で確認してください。"
            : "DB の RLS ポリシーが拒否し、Vercel に SUPABASE_SERVICE_ROLE_KEY 環境変数も未設定です。下記いずれかをお願いします:\n(A) Supabase で migration 0033 を実行\n(B) Vercel Settings → Environment Variables に SUPABASE_SERVICE_ROLE_KEY を追加して再デプロイ",
          debug: { user_id: user.id, supabase_error: orgErr.message, used_service_role: useServiceRole },
        },
        { status: 403 },
      );
    }
    return NextResponse.json(
      {
        error: orgErr?.message ?? "組織作成に失敗しました",
        debug: { user_id: user.id, used_service_role: useServiceRole },
      },
      { status: 500 },
    );
  }

  const { error: memErr } = await writer.from("memberships").insert({
    user_id: user.id,
    organization_id: org.id,
    role: "owner",
  });
  if (memErr) {
    return NextResponse.json(
      {
        error: `組織は作れましたが、オーナー登録に失敗: ${memErr.message}`,
        org,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ org }, { status: 201 });
}
