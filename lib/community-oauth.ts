/**
 * community_dashboard (外部 Supabase OAuth Server) との OAuth 2.1 連携設定。
 * Authorization Code + PKCE / public client (client_secret なし)。
 * AI PM のログイン手段の一つとして使う。
 */

const COMMUNITY_BASE =
  process.env.NEXT_PUBLIC_COMMUNITY_BASE ??
  "https://ghxdhsnqhsybmghfqyfd.supabase.co";

export const COMMUNITY_OAUTH = {
  authorizeUrl: `${COMMUNITY_BASE}/auth/v1/oauth/authorize`,
  tokenUrl: `${COMMUNITY_BASE}/auth/v1/oauth/token`,
  meUrl: `${COMMUNITY_BASE}/functions/v1/public-api-me`,
  projectsUrl: `${COMMUNITY_BASE}/functions/v1/public-api-projects`,
  projectDetailUrl: `${COMMUNITY_BASE}/functions/v1/public-api-project-detail`,
  scope: "openid email profile",
} as const;

/** public client の client_id (env 経由)。未設定ならログインボタンを出さない。 */
export const COMMUNITY_CLIENT_ID =
  process.env.NEXT_PUBLIC_COMMUNITY_CLIENT_ID ?? "";

/** 登録済み redirect_uri と完全一致させる (末尾スラッシュ無し)。 */
export function communityRedirectUri(): string {
  return `${window.location.origin}/oauth/community/callback`;
}

const STORAGE_VERIFIER = "community:pkce_verifier";
const STORAGE_STATE = "community:oauth_state";
const STORAGE_NEXT = "community:next";

function base64url(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(input: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return new Uint8Array(digest);
}

/** PKCE の verifier/challenge と CSRF state を生成し sessionStorage に保存。 */
export async function startCommunityLogin(next: string): Promise<void> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(64)));
  const challenge = base64url(await sha256(verifier));
  const state = base64url(crypto.getRandomValues(new Uint8Array(16)));

  sessionStorage.setItem(STORAGE_VERIFIER, verifier);
  sessionStorage.setItem(STORAGE_STATE, state);
  sessionStorage.setItem(STORAGE_NEXT, next);

  const u = new URL(COMMUNITY_OAUTH.authorizeUrl);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", COMMUNITY_CLIENT_ID);
  u.searchParams.set("redirect_uri", communityRedirectUri());
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("scope", COMMUNITY_OAUTH.scope);
  window.location.href = u.toString();
}

export interface CommunityCallbackData {
  verifier: string;
  state: string;
  next: string;
}

/** コールバック時に保存値を取り出す (取り出し後はクリア)。 */
export function consumeCommunityLoginState(): CommunityCallbackData {
  const verifier = sessionStorage.getItem(STORAGE_VERIFIER) ?? "";
  const state = sessionStorage.getItem(STORAGE_STATE) ?? "";
  const next = sessionStorage.getItem(STORAGE_NEXT) || "/orgs";
  sessionStorage.removeItem(STORAGE_VERIFIER);
  sessionStorage.removeItem(STORAGE_STATE);
  sessionStorage.removeItem(STORAGE_NEXT);
  return { verifier, state, next };
}
