import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-url";

// 公開LP (/lp) のみインデックス許可。アプリ本体 (認証必須) と API は除外。
export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/lp",
      disallow: ["/orgs", "/me", "/welcome", "/join", "/auth", "/api", "/login"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
