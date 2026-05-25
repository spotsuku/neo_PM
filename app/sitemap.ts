import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-url";

// 未ログインで公開している静的ページのみ掲載。
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const now = new Date();
  return [
    {
      url: `${base}/lp`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
