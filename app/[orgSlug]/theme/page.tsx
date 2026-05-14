import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { ThemeStudio } from "@/components/theme/ThemeStudio";

export const dynamic = "force-dynamic";

export default async function ThemePage({
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return <div className="p-8">サインインが必要です</div>;
  }

  // 出題できるのは admin / owner / theme_owner
  const { data: my } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();
  const canPost =
    my?.role === "owner" ||
    my?.role === "admin" ||
    my?.role === "theme_owner";
  if (!canPost) {
    return (
      <div className="p-8 text-error">
        テーマ出題の権限がありません。テーマオーナーまたは管理者に依頼してください。
      </div>
    );
  }

  // 1オーナー実質1テーマ運用: 最新の1件を取得。無ければ自動作成。
  let { data: theme } = await supabase
    .from("themes")
    .select("*")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!theme) {
    const { data: created } = await supabase
      .from("themes")
      .insert({
        organization_id: org.id,
        title: "新しいテーマ",
        code: "NEO-001",
        status: "draft",
      })
      .select()
      .single();
    theme = created;
  }
  if (!theme) {
    return (
      <div className="p-8 text-error">
        テーマの作成に失敗しました。Supabase の RLS / マイグレーションをご確認ください。
      </div>
    );
  }

  return (
    <ThemeStudio
      orgSlug={orgSlug}
      orgName={org.name}
      initialTheme={theme}
    />
  );
}
