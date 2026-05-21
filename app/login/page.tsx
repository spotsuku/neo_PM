import { Suspense } from "react";

import { LoginForm } from "@/components/login/LoginForm";

// Skip build-time prerender: LoginForm's createClient() needs the
// NEXT_PUBLIC_SUPABASE_* env vars which only exist at runtime on
// Vercel. Static prerender without them throws.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "ログイン — AI PM",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <Suspense
        fallback={<div className="t-cap">読み込み中...</div>}
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
