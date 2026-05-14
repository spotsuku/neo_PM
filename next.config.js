/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
  images: {
    // 画像投稿は <Image unoptimized /> で出しているので
    // 厳密には不要だが、念のため Supabase Storage を許可
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
    ],
  },
};

module.exports = nextConfig;
