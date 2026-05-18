import Link from "next/link";

import { CreateOrgForm } from "@/components/orgs/CreateOrgForm";

// CreateOrgForm's createClient() needs NEXT_PUBLIC_SUPABASE_* which
// only exist at runtime. Skip static prerender to avoid build crashes.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "新しい組織 — NEO PM",
};

export default function NewOrgPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="glass-strong w-full max-w-md p-8 md:p-10 animate-risein">
        <h1 className="t-h2 mb-2">新しい組織を作成</h1>
        <p className="t-cap mb-6">
          NEO 福岡のような組織単位でテーマとプロジェクトを管理します。後から名前は変更できます。
        </p>
        <CreateOrgForm />
        <div className="mt-6 text-center">
          <Link href="/orgs" className="t-cap underline">
            ← 組織一覧へ戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
