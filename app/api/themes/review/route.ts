import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";

export const runtime = "nodejs";

interface DecisionInput {
  item_key: string;
  decision: "approved" | "changes_requested" | null;
  comment: string | null;
}
interface Body {
  themeId: string;
  approve: boolean;
  decisions: DecisionInput[];
  /** 採点者の代理指定。指定されたユーザを reviewed_by として記録する。
   *  そのユーザは対象組織の owner/admin である必要がある。
   *  未指定 (or 当人) なら現在ユーザーが reviewed_by。 */
  scored_as_user_id?: string;
}

/**
 * テーマ審査 (承認 / 差し戻し) をサーバ側で確定する。
 * - ユーザが対象テーマの組織の owner / admin かを検証
 * - 書き込みは SERVICE_ROLE で実行 (RLS の適用漏れで静かに保存失敗するのを防ぐ)。
 *   SERVICE_ROLE 未設定時はユーザクライアントにフォールバックし、失敗時は実エラーを返す。
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<Body>;
  const themeId = body.themeId;
  if (!themeId) {
    return NextResponse.json({ error: "themeId は必須です" }, { status: 400 });
  }
  const approve = !!body.approve;
  const decisions = Array.isArray(body.decisions) ? body.decisions : [];

  // テーマの組織を取得 → ユーザが owner/admin か検証
  const { data: theme } = await supabase
    .from("themes")
    .select("id, organization_id")
    .eq("id", themeId)
    .maybeSingle();
  if (!theme) {
    return NextResponse.json({ error: "テーマが見つかりません" }, { status: 404 });
  }
  const { data: mem } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", theme.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (mem?.role !== "owner" && mem?.role !== "admin") {
    return NextResponse.json({ error: "審査権限がありません" }, { status: 403 });
  }

  // 採点者の代理指定: 指定されたユーザが同じ org の owner/admin であることを検証。
  // 該当ユーザを reviewed_by に記録する。未指定 / 当人 / 不正なら現ユーザー。
  const scoredAsUserId = (body.scored_as_user_id ?? "").trim();
  let recordedBy = user.id;
  if (scoredAsUserId && scoredAsUserId !== user.id) {
    const { data: targetMem } = await supabase
      .from("memberships")
      .select("role")
      .eq("organization_id", theme.organization_id)
      .eq("user_id", scoredAsUserId)
      .maybeSingle();
    if (targetMem?.role === "owner" || targetMem?.role === "admin") {
      recordedBy = scoredAsUserId;
    } else {
      return NextResponse.json(
        {
          error:
            "指定された採点者は対象組織の管理者ではありません。採点者を選び直してください。",
        },
        { status: 400 },
      );
    }
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const usingServiceRole = !!(serviceKey && url);
  const writer = usingServiceRole
    ? createSupabaseClient<Database>(url!, serviceKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : supabase;

  const now = new Date().toISOString();

  // 保存対象: 判定が付いた項目 + (差し戻し時のみ) コメントだけ書かれた項目。
  const rows = decisions
    .filter((d) => {
      if (d.decision === "approved" || d.decision === "changes_requested")
        return true;
      return !approve && (d.comment ?? "").trim() !== "";
    })
    .map((d) => ({
      target_type: "theme" as const,
      target_id: themeId,
      item_key: d.item_key,
      decision: (d.decision ?? "changes_requested") as
        | "approved"
        | "changes_requested",
      comment: (d.comment ?? "").trim() || null,
      reviewed_by: recordedBy,
      updated_at: now,
    }));

  if (rows.length > 0) {
    const { error: upErr } = await writer
      .from("review_decisions")
      .upsert(rows, { onConflict: "target_type,target_id,item_key" });
    if (upErr) {
      return NextResponse.json(
        {
          error: `審査コメントの保存に失敗しました: ${upErr.message}`,
          debug: { usingServiceRole },
        },
        { status: 500 },
      );
    }
  } else if (!approve) {
    return NextResponse.json(
      { error: "差し戻すには、少なくとも1項目にコメントを入力してください。" },
      { status: 400 },
    );
  }

  // 承認時は 'active' (即公開) ではなく 'approved' (承認済・非公開) に留める。
  // 出題者が別途「公開する」ボタンで 'active' に切り替える 2 ステップ運用。
  const status = approve ? "approved" : "changes_requested";
  const { error: te } = await writer
    .from("themes")
    .update({
      status,
      reviewed_at: now,
      reviewed_by: recordedBy,
      review_note: approve ? null : "項目ごとのコメントを確認してください",
    } as never)
    .eq("id", themeId);
  if (te) {
    return NextResponse.json(
      {
        error: `ステータス更新に失敗しました: ${te.message}`,
        debug: { usingServiceRole },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, status, saved: rows.length });
}
