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

/** community_dashboard の /me レスポンスからプロフィール情報を抽出。
 *  レスポンス形状が不確定なので複数パスを許容する。 */
export interface CommunityProfile {
  display_name: string | null;
  avatar_url: string | null;
  affiliation: string | null;
  title: string | null;
  bio: string | null;
  cohort_names: string[]; // 参考: 第X期の名前
}

function extractProfile(me: unknown): CommunityProfile {
  const m = me as Record<string, unknown> | null;
  const containers = [
    m,
    m?.me as Record<string, unknown> | undefined,
    m?.user as Record<string, unknown> | undefined,
    m?.profile as Record<string, unknown> | undefined,
    m?.data as Record<string, unknown> | undefined,
  ].filter(Boolean) as Record<string, unknown>[];

  const toStr = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === "string") return v.trim() || null;
    if (typeof v === "number") return String(v);
    return null;
  };

  const pick = (keys: string[]): string | null => {
    for (const cont of containers) {
      for (const k of keys) {
        const v = toStr(cont[k]);
        if (v) return v;
      }
    }
    return null;
  };

  // 期の名前 (「第2期」など) を抽出
  const cohortNames: string[] = [];
  for (const cont of containers) {
    const raw = cont.cohorts;
    if (Array.isArray(raw)) {
      for (const c of raw) {
        const name = toStr((c as Record<string, unknown> | null)?.name);
        if (name) cohortNames.push(name);
      }
    }
  }

  return {
    display_name: pick([
      // 日本語名を最優先 (community_dashboard が返す可能性が高い順)
      "real_name",
      "name_ja",
      "display_name_ja",
      "japanese_name",
      "full_name_kanji",
      "kanji_name",
      "last_name_ja",
      // 一般的な名前フィールド
      "display_name",
      "full_name",
      "fullname",
      "name",
      // ハンドル系 (英字混じりの可能性あり) は最後のフォールバック
      "nickname",
      "handle",
      "username",
    ]),
    avatar_url: pick([
      // public-api-me が実際に返すキー (署名付き URL, 1h で失効)
      "iconUrl",
      "avatar_url",
      "avatar",
      "picture",
      "image",
      "photo_url",
      "icon_url",
    ]),
    affiliation: pick([
      "affiliation",
      "company",
      "organization",
      "organization_name",
      "workplace",
    ]),
    title: pick([
      "title",
      "job_title",
      "position",
      "role",
      "occupation",
    ]),
    bio: pick(["bio", "description", "profile_text", "about"]),
    cohort_names: Array.from(new Set(cohortNames)),
  };
}

function extractCohortIds(me: unknown): string[] {
  const m = me as Record<string, unknown> | null;
  if (!m) return [];
  const containers = [m, m.me as Record<string, unknown> | undefined];
  const toStr = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === "string") return v.trim() || null;
    if (typeof v === "number") return String(v);
    return null;
  };
  const asObj = (v: unknown): Record<string, unknown> | undefined =>
    v && typeof v === "object" ? (v as Record<string, unknown>) : undefined;
  const out: string[] = [];
  for (const cont of containers) {
    if (!cont) continue;
    // 配列形式
    const raw = cont.cohorts;
    if (Array.isArray(raw)) {
      for (const c of raw) {
        const id = toStr((c as Record<string, unknown> | null)?.id);
        if (id) out.push(id);
      }
    }
    // 単数形式
    const single =
      toStr(cont.cohort_id) ??
      toStr(cont.cohort) ??
      toStr(asObj(cont.cohort)?.id);
    if (single) out.push(single);
  }
  return Array.from(new Set(out));
}

const AVATAR_BUCKET = "project-posts";

/** community から受け取ったアバター画像 (署名付き URL, 1h で失効) を取得し、
 *  AI PM 自前のストレージ (project-posts バケット) に再アップロードして
 *  失効しない公開 URL を返す。取得/アップロードに失敗したら null。 */
async function rehostAvatar(
  admin: ReturnType<typeof createSupabaseClient<Database>>,
  userId: string,
  sourceUrl: string,
): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : contentType.includes("gif")
          ? "gif"
          : "jpg";
    const buffer = new Uint8Array(await res.arrayBuffer());
    // ユーザ毎に固定パスへ upsert (毎ログインで再アップロードしてもストレージが
    // 肥大化しないように)
    const path = `user-avatars/${userId}/community.${ext}`;
    const { error: upErr } = await admin.storage
      .from(AVATAR_BUCKET)
      .upload(path, buffer, { upsert: true, contentType });
    if (upErr) {
      console.warn("[community/callback] avatar upload failed", upErr.message);
      return null;
    }
    const { data } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) return null;
    // 固定パスなのでキャッシュバスティング用のクエリを付与
    return `${data.publicUrl}?v=${Date.now()}`;
  } catch (e) {
    console.warn("[community/callback] avatar fetch failed", e);
    return null;
  }
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
  if (requiredCohortId && cohortIds.length === 0) {
    console.warn(
      "[community/callback] cohort_ids not found in me response. me:",
      JSON.stringify(me)?.slice(0, 800),
    );
  }

  // プロフィール情報を抽出 (名前 / アバター / 所属 / 肩書 / bio / 期名)
  const communityProfile = extractProfile(me);

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
          // プロフィール情報のスナップショット (診断 + フォールバック用)
          community_profile: communityProfile,
          // 診断用: community が実際に返した生 JSON のスナップショット
          // (先頭 2KB のみ。フィールド名特定用。落ち着いたら消してよい)
          community_raw_me: JSON.stringify(me)?.slice(0, 2000) ?? null,
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

  // ── AI PM の profiles テーブルを community プロフィールで補完 ──────
  //   community 側は「本人が使いたい名前」の source of truth。
  //   community が名前を返した場合は community 側を優先して上書きする。
  //   ただし community 側の値が「メールアドレスのローカルパート」(magic link
  //   がデフォルトで付ける英字名) と同じなら本物のプロフィール名ではないので
  //   上書きしない (既存を残す)。
  if (userId) {
    try {
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", userId)
        .maybeSingle();

      // community 側の名前が「メールのローカルパート」と一致するなら
      // それは自動生成された handle なので採用しない。
      const emailLocal = email.split("@")[0] ?? "";
      const communityName = communityProfile.display_name;
      const isFallbackHandle =
        !!communityName &&
        communityName.trim().toLowerCase() === emailLocal.toLowerCase();

      // 既存プロフィールの名前も同様に「メールローカルパート」なら
      // 自動生成された仮の名前なので、community 名で上書きする。
      const existingIsHandle =
        !!existingProfile?.display_name &&
        existingProfile.display_name.trim().toLowerCase() ===
          emailLocal.toLowerCase();

      // 優先順位:
      //  1. community が返した本物の名前 (handle 一致でない)
      //  2. 既存の profile (本人が設定した名前。ただし handle なら不採用)
      // メール由来の handle は表示名として保存しない (無ければ null のまま)。
      const nextDisplayName =
        (!isFallbackHandle ? communityName : null) ||
        (!existingIsHandle ? existingProfile?.display_name : null) ||
        null;

      // アバターも同様に community 優先 (community が返した時のみ)。
      // community の iconUrl は 1h で失効する署名付き URL なので、
      // そのまま保存せず自前ストレージに再ホストしてから使う。
      let nextAvatarUrl = existingProfile?.avatar_url || null;
      if (communityProfile.avatar_url) {
        const rehosted = await rehostAvatar(
          admin,
          userId,
          communityProfile.avatar_url,
        );
        if (rehosted) nextAvatarUrl = rehosted;
      }

      // 何か上書き対象があれば upsert。
      // existingIsHandle かつ community も名前を返さなかった場合は、
      // メール由来の handle を消す (null 化) ために upsert する。
      if (
        nextDisplayName !== (existingProfile?.display_name ?? null) ||
        (nextAvatarUrl && nextAvatarUrl !== existingProfile?.avatar_url)
      ) {
        await admin
          .from("profiles")
          .upsert(
            {
              id: userId,
              display_name: nextDisplayName,
              avatar_url: nextAvatarUrl,
            } as never,
            { onConflict: "id" },
          )
          .then(({ error: e }) => {
            if (e) {
              console.warn(
                "[community/callback] profiles upsert failed",
                e.message,
              );
            }
          });
      }
    } catch (e) {
      console.warn("[community/callback] profile sync failed", e);
    }
  }

  // 既存 membership が全く無いユーザのための personal org fallback
  await ensurePersonalOrg(supabase).catch(() => null);

  return NextResponse.json({ ok: true });
}
