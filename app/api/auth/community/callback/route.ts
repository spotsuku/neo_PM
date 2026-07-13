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

/** public-api-me レスポンスから cohort id 配列を取り出す (文字列に正規化)。
 *  レスポンス形状が不確定なので me.cohorts / me.me.cohorts の両方を許容する。 */
function extractCohortIds(me: unknown): string[] {
  const m = me as Record<string, unknown> | null;
  if (!m) return [];
  const containers = [m, m.me as Record<string, unknown> | undefined];
  for (const cont of containers) {
    const raw = cont?.cohorts;
    if (Array.isArray(raw)) {
      return raw
        .map((c) => (c as Record<string, unknown> | null)?.id)
        .filter((id) => id !== null && id !== undefined)
        .map((id) => String(id));
    }
  }
  return [];
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

  // cohort (期) を取得。NEO_COMMUNITY_REQUIRED_COHORT_ID が設定されていれば
  // その cohort に所属しているかを判定する (未設定なら制限なし = true)。
  const cohortIds = extractCohortIds(me);
  const requiredCohortId = process.env.NEO_COMMUNITY_REQUIRED_COHORT_ID?.trim();
  const cohortOk = requiredCohortId
    ? cohortIds.includes(requiredCohortId)
    : true;

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
          // cohort (期) スナップショット。community_cohort_ok は
          // NEO_COMMUNITY_REQUIRED_COHORT_ID を満たすか (未設定なら true)。
          community_cohort_ids: cohortIds,
          community_cohort_ok: cohortOk,
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
