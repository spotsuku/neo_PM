/** ユーザ表示名 / アバターの解決を一箇所に集約するヘルパー。
 *
 *  表示名の source of truth は profiles.display_name (community_dashboard
 *  ログイン時に community 側の氏名で同期される)。
 *  profiles が無い / 空の場合のみ user_metadata → メールローカルパートに
 *  フォールバックする。
 */

export interface DisplayProfile {
  display_name?: string | null;
  avatar_url?: string | null;
}

export interface DisplayUser {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

const clean = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t || null;
};

/** メールのローカルパート (@ の手前)。名前が無い時の最終フォールバック。 */
export function emailLocalPart(email?: string | null): string | null {
  if (!email) return null;
  return clean(email.split("@")[0]);
}

/**
 * 表示名を解決する。
 *  1. profiles.display_name (community 同期済みの氏名)
 *  2. user_metadata.display_name / name / full_name
 *  3. メールのローカルパート
 *  4. fallback 文字列
 */
export function getDisplayName(
  profile?: DisplayProfile | null,
  user?: DisplayUser | null,
  fallback = "ゲスト",
): string {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  return (
    clean(profile?.display_name) ??
    clean(meta.display_name) ??
    clean(meta.name) ??
    clean(meta.full_name) ??
    emailLocalPart(user?.email) ??
    fallback
  );
}

/** アバター画像 URL。無ければ null (呼び出し側でイニシャル表示にフォールバック)。 */
export function getAvatarUrl(
  profile?: DisplayProfile | null,
  user?: DisplayUser | null,
): string | null {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  return clean(profile?.avatar_url) ?? clean(meta.avatar_url) ?? null;
}

/** イニシャル 1 文字。日本語名はそのまま先頭 1 文字、英字は大文字化。 */
export function getInitial(name?: string | null): string {
  const t = clean(name);
  if (!t) return "?";
  return t[0]!.toUpperCase();
}
