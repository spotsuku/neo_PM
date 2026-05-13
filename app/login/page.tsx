import { Suspense } from "react";

import { LoginForm } from "@/components/login/LoginForm";

export const metadata = {
  title: "ログイン — NEO PM",
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
