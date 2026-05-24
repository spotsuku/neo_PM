import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { CreateProjectForm } from "@/components/projects/CreateProjectForm";

// CreateProjectForm's createClient() needs NEXT_PUBLIC_SUPABASE_* which
// only exist at runtime. Skip static prerender to avoid build crashes.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "新規プロジェクト — AI PM",
};

const HARDCODED_DEFAULTS = [
  { label: "キックオフ", weekOffset: 0 },
  { label: "仮説検証 完了", weekOffset: 4 },
  { label: "プロトタイプ", weekOffset: 10 },
  { label: "現場テスト", weekOffset: 16 },
  { label: "本番実施", weekOffset: 22 },
  { label: "振り返り", weekOffset: 26 },
];

function normalizeMilestones(
  raw: unknown,
): { label: string; weekOffset: number }[] {
  if (!Array.isArray(raw)) return HARDCODED_DEFAULTS;
  const valid = raw
    .filter(
      (it): it is { label: string; weekOffset: number } =>
        typeof it === "object" &&
        it !== null &&
        typeof (it as Record<string, unknown>).label === "string" &&
        typeof (it as Record<string, unknown>).weekOffset === "number",
    )
    .map((it) => ({
      label: it.label,
      weekOffset: it.weekOffset,
    }));
  return valid.length > 0 ? valid : HARDCODED_DEFAULTS;
}

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

  // 新規作成は owner / admin / theme_owner のみ。
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: myMembership } = user
    ? await supabase
        .from("memberships")
        .select("role")
        .eq("organization_id", org.id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };
  const canCreate =
    myMembership?.role === "owner" ||
    myMembership?.role === "admin" ||
    myMembership?.role === "theme_owner";
  if (!canCreate) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        <Link href={`/${orgSlug}`} className="t-cap underline">
          ← ホームへ戻る
        </Link>
        <div className="rounded-2xl border border-line bg-white p-10 text-center">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="t-h2 mb-2">プロジェクトの作成権限がありません</h1>
          <p className="t-cap leading-relaxed">
            新規プロジェクトの作成は、組織の管理者またはテーマオーナーのみが行えます。
            作成が必要な場合は管理者にご相談ください。
          </p>
        </div>
      </div>
    );
  }

  const { data: themes } = await supabase
    .from("themes")
    .select("id, title, code")
    .eq("organization_id", org.id)
    .in("status", ["active", "draft"])
    .order("created_at", { ascending: false });

  const defaultMilestones = normalizeMilestones(org.default_milestones);

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
          チーム名と最初の構想を入れるだけで OK。マイルストーンは自由に編集できます。
        </p>
      </header>
      <CreateProjectForm
        orgSlug={orgSlug}
        orgId={org.id}
        themes={themes ?? []}
        defaultMilestones={defaultMilestones}
      />
    </div>
  );
}
