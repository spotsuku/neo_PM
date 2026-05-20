import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface Body {
  name: string;
  slug: string;
  competition_enabled?: boolean;
}

/** サーバサイドで組織を作成。クライアント側で JWT が乗らないケースを回避する。
 *  - Supabase クッキー認証を使うのでサーバから見れば auth.uid() は確実に存在
 *  - 組織作成 → 自分を owner として memberships に登録 → 全部成功すれば return
 *  - 失敗時はわかりやすい日本語エラーを返す */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: ue,
  } = await supabase.auth.getUser();
  if (ue || !user) {
    return NextResponse.json(
      { error: "ログインが必要です (auth session 取得失敗)" },
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

  const { data: org, error: orgErr } = await supabase
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
        { error: `スラッグ「${slug}」は既に使われています。別の slug を指定してください。` },
        { status: 409 },
      );
    }
    if (
      orgErr?.message?.includes("row-level security") ||
      orgErr?.message?.includes("violates row-level security")
    ) {
      return NextResponse.json(
        {
          error:
            "DB の RLS ポリシーが拒否しました。Supabase で migration 0033_org_insert_policy_repair.sql を実行してください。",
          debug: { user_id: user.id, supabase_error: orgErr.message },
        },
        { status: 403 },
      );
    }
    return NextResponse.json(
      {
        error: orgErr?.message ?? "組織作成に失敗しました",
        debug: { user_id: user.id },
      },
      { status: 500 },
    );
  }

  const { error: memErr } = await supabase.from("memberships").insert({
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
