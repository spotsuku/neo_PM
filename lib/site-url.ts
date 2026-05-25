/**
 * 公開URLの解決。優先順位:
 *  1. NEXT_PUBLIC_SITE_URL (本番ドメインを明示設定する場合)
 *  2. Vercel の本番ドメイン (VERCEL_PROJECT_PRODUCTION_URL)
 *  3. localhost (開発)
 * robots.txt / sitemap.xml の absolute URL 生成に使う。
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}
