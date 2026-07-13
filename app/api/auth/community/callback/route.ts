import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { ensurePersonalOrg } from "@/lib/orgs";
import { COMMUNITY_OAUTH } from "@/lib/community-oauth";
import type { Database } from "@/lib/types/database";

export const runtime = "nodejs";

interface Body {
  code: string;
  verifier: string;
  redirectUri: string;
}

/** community_dashboard のレスポンスからメールアドレスを取り出す。
 *  レスポンス形状が不確定なので複数パターンを許容する。 */
function extractEmail(me: unknown): string | null {
  const m = me as Record<string, unknown> | null;
  if (!m) return null;
  const candidates = [
    m.email,
    // public-api-me は ok({ me: {...} }) を返すため email は me.email に入る
    (m.me as Record<string, unknown> | undefined)?.email,
    (m.user as Record<string, unknown> | undefined)?.email,
    (m.data as Record<string, unknown> | undefined)?.email,
    (m.profile as Record<string, unknown> | undefined)?.email,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.includes("@")) return c.trim().toLowerCase();
  }
  return null;
}

/** community_dashboard のレスポンスから cohort_id (期) を取り出す。
 *  可能性のあるパスを網羅して string にして返す (比較を文字列で行うため)。 */
function extractCohortId(me: unknown): string | null {
  const m = me as Record<string, unknown> | null;
  if (!m) return null;
  const meNested = m.me as Record<string, unknown> | undefined;
  const userNested = m.user as Record<string, unknown> | undefined;
  const dataNested = m.data as Record<string, unknown> | undefined;
  const profileNested = m.profile as Record<string, unknown> | undefined;

  const toStr = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === "string") return v.trim() || null;
    if (typeof v === "number") return String(v);
    return null;
  };

  const asObj = (v: unknown): Record<string, unknown> | undefined =>
    v && typeof v === "object" ? (v as Record<string, unknown>) : undefined;

  const candidates = [
    // トップレベル
    toStr(m.cohort_id),
    toStr(m.cohort),
    toStr(asObj(m.cohort)?.id),
    toStr(m.term_id),
    toStr(m.class_id),
    // me.*
    toStr(meNested?.cohort_id),
    toStr(meNested?.cohort),
    toStr(asObj(meNested?.cohort)?.id),
    toStr(meNested?.term_id),
    toStr(meNested?.class_id),
    // user.*
    toStr(userNested?.cohort_id),
    toStr(userNested?.cohort),
    toStr(asObj(userNested?.cohort)?.id),
    // data.*
    toStr(dataNested?.cohort_id),
    toStr(asObj(dataNested?.cohort)?.id),
    // profile.*
    toStr(profileNested?.cohort_id),
    toStr(asObj(profileNested?.cohort)?.id),
  ];

  for (const c of candidates) if (c) return c;
  return null;
}

/**
 * community_dashboard OAuth のコールバック処理 (サーバ側)。
 *  1. code → community トークン交換 (public client, secret なし)
 *  2. public-api-me でメールを取得しトークンを検証
 *  3. 同メールの AI PM ユーザにセッションを発行 (service-role で
 *     create-or-find → magiclink 生成 → verifyOtp で Cookie 確立)
 */
export async function POST(req: Request) {
  const clientId = process.env.NEXT_PUBLIC_COMMUNITY_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "community 連携が未設定です (client_id 未設定)" },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Partial<Body>;
  const { code, verifier, redirectUri } = body;
  if (!code || !verifier || !redirectUri) {
    return NextResponse.json(
      { error: "code / verifier / redirectUri は必須です" },
      { status: 400 },
    );
  }

  // 1) トークン交換 (confidential client: client_secret を付与。PKCE も併用)
  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  const clientSecret = process.env.COMMUNITY_CLIENT_SECRET;
  if (clientSecret) tokenParams.set("client_secret", clientSecret);

  const tokenRes = await fetch(COMMUNITY_OAUTH.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams,
  });
  if (!tokenRes.ok) {
    const detail = await tokenRes.text().catch(() => "");
    return NextResponse.json(
      { error: `community トークン取得に失敗 (${tokenRes.status})`, detail: detail.slice(0, 300) },
      { status: 502 },
    );
  }
  const token = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string;
  };
  if (!token.access_token) {
    return NextResponse.json(
      { error: "community トークンが空でした" },
      { status: 502 },
    );
  }

  // 2) 本人確認 (メール取得)
  const meRes = await fetch(COMMUNITY_OAUTH.meUrl, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!meRes.ok) {
    return NextResponse.json(
      { error: `community プロフィール取得に失敗 (${meRes.status})` },
      { status: 502 },
    );
  }
  const me = await meRes.json().catch(() => null);
  // 診断用: community からのレスポンス形を確認するため一時的にログ出力。
  // email がどのキーに入っているか判明したら削除する。
  console.log(
    "[community/callback] me response:",
    JSON.stringify(me)?.slice(0, 1500),
  );
  const email = extractEmail(me);
  if (!email) {
    return NextResponse.json(
      { error: "community からメールアドレスを取得できませんでした" },
      { status: 502 },
    );
  }

  // 2.5) 期 (cohort) 制御: NEO_COMMUNITY_REQUIRED_COHORT_ID が設定されていれば
  //      その期の受講生のみログイン許可する。community 側のレスポンスから
  //      cohort_id を抽出して比較する (文字列比較)。
  const requiredCohortId =
    process.env.NEO_COMMUNITY_REQUIRED_COHORT_ID?.trim() || null;
  const communityCohortId = extractCohortId(me);
  if (requiredCohortId) {
    if (!communityCohortId) {
      console.warn(
        "[community/callback] cohort_id not found in me response. me:",
        JSON.stringify(me)?.slice(0, 800),
      );
      return NextResponse.json(
        {
          error:
            "community 側のプロフィールに期 (cohort) 情報が含まれていません。ログインを許可できません。",
        },
        { status: 403 },
      );
    }
    if (String(communityCohortId) !== String(requiredCohortId)) {
      return NextResponse.json(
        {
          error: `第${requiredCohortId}期の受講生のみログインできます (あなたの期: ${communityCohortId})。`,
        },
        { status: 403 },
      );
    }
  }

  // 3) AI PM セッション発行
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return NextResponse.json(
      { error: "サーバ設定不足 (SUPABASE_SERVICE_ROLE_KEY 未設定)" },
      { status: 500 },
    );
  }
  const admin = createSupabaseClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 既存ユーザならスキップ (重複エラーは無視)。email_confirm 済みで作成。
  await admin.auth.admin
    .createUser({ email, email_confirm: true })
    .catch(() => null);

  const { data: linkData, error: linkErr } =
    await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = linkData?.properties?.hashed_token;
  if (linkErr || !tokenHash) {
    return NextResponse.json(
      { error: `AI PM セッション生成に失敗: ${linkErr?.message ?? "token_hash 不在"}` },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const { error: otpErr } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (otpErr) {
    return NextResponse.json(
      { error: `セッション確立に失敗: ${otpErr.message}` },
      { status: 500 },
    );
  }

  // 現在の user_id を取得 (以降の自動所属で使う)
  const {
    data: { user: authedUser },
  } = await supabase.auth.getUser();
  const userId = authedUser?.id ?? null;

  // ── community login した人にフラグを立てる ──────────────
  //   NEO_COMMUNITY_ORG_SLUG が設定されていれば、その slug を user_metadata に
  //   保存する。/orgs 画面がこのフラグを見て「参加できる組織」として NEO ACADEMIA を
  //   表示し、本人が明示的に「参加」を押すと membership が作られる (招待型フロー)。
  //
  //   自動 membership 作成はしない (community 認証されていない他人が想定外に
  //   組織に入るのを避けるため + 本人の意思を明示化するため)。
  const communityOrgSlug = process.env.NEO_COMMUNITY_ORG_SLUG?.trim();
  if (userId && communityOrgSlug) {
    try {
      const existingMeta = (authedUser?.user_metadata ?? {}) as Record<
        string,
        unknown
      >;
      const { error: metaErr } = await admin.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...existingMeta,
          community_verified: true,
          community_verified_at: new Date().toISOString(),
          community_invited_org_slug: communityOrgSlug,
          ...(communityCohortId
            ? { community_cohort_id: String(communityCohortId) }
            : {}),
        },
      });
      if (metaErr) {
        console.warn(
          "[community/callback] user_metadata update failed",
          metaErr.message,
        );
      }
    } catch (e) {
      console.warn("[community/callback] flag failed", e);
    }
  }

  // 既存 membership が全く無いユーザのための personal org fallback
  await ensurePersonalOrg(supabase).catch(() => null);

  return NextResponse.json({ ok: true });
}
