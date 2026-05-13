import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { CreateProjectForm } from "@/components/projects/CreateProjectForm";

export const metadata = {
  title: "新規プロジェクト — NEO PM",
};

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createClient();
  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) {
    return <div className="p-8 text-error">組織が見つかりません</div>;
  }

  const { data: themes } = await supabase
    .from("themes")
    .select("id, title, code")
    .eq("organization_id", org.id)
    .in("status", ["active", "draft"])
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <header>
        <Link href={`/${orgSlug}`} className="t-cap underline">
          ← ランキングへ戻る
        </Link>
        <h1 className="t-h2 mt-2">
          <span aria-hidden className="mr-2">
            🌱
          </span>
          新規プロジェクトを始める
        </h1>
        <p className="t-cap mt-1">
          チーム名と最初の構想を入れるだけで OK。マイルストーンは自動で6つ仮置きします。後から編集できます。
        </p>
      </header>
      <CreateProjectForm
        orgSlug={orgSlug}
        orgId={org.id}
        themes={themes ?? []}
      />
    </div>
  );
}
