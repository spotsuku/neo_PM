import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { ThemeStudio } from "@/components/theme/ThemeStudio";

export const dynamic = "force-dynamic";

export default async function ThemePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { orgSlug } = await params;
  const { t: explicitThemeId } = await searchParams;
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

  // 自分が出題したテーマを全て (見本含む) 取得。
  // posted_by が自分 ‖ org owner/admin で誰の theme でも編集可能。
  const isOrgAdmin = my?.role === "owner" || my?.role === "admin";
  const themesQuery = supabase
    .from("themes")
    .select("*")
    .eq("organization_id", org.id)
    .order("is_demo", { ascending: true })  // 見本は後ろに
    .order("created_at", { ascending: false });
  // theme_owner なら自分が posted_by のものだけ
  const { data: myThemes } = isOrgAdmin
    ? await themesQuery
    : await themesQuery.eq("posted_by", user.id);

  // 表示するテーマを決定:
  //  1. ?t=<id> 明示指定
  //  2. 見本以外で最新
  //  3. 見本でも何でも最新
  //  4. 無ければ自動作成
  let theme = null as (typeof myThemes extends (infer T)[] | null ? T : never) | null;
  if (myThemes && myThemes.length > 0) {
    if (explicitThemeId) {
      theme = myThemes.find((x) => x.id === explicitThemeId) ?? null;
    }
    if (!theme) {
      theme =
        myThemes.find((x) => !x.is_demo) ??
        myThemes[0] ??
        null;
    }
  }

  if (!theme) {
    const { data: created } = await supabase
      .from("themes")
      .insert({
        organization_id: org.id,
        title: "新しいテーマ",
        code: "NEO-001",
        status: "draft",
        posted_by: user.id,
      })
      .select()
      .single();
    theme = created;
  }
  // posted_by が未設定なら自分で埋める
  if (theme && !theme.posted_by) {
    await supabase
      .from("themes")
      .update({ posted_by: user.id })
      .eq("id", theme.id)
      .is("posted_by", null);
    theme = { ...theme, posted_by: user.id };
  }
  if (!theme) {
    return (
      <div className="p-8 text-error">
        テーマの作成に失敗しました。Supabase の RLS / マイグレーションをご確認ください。
      </div>
    );
  }

  const themeList = (myThemes ?? []).map((x) => ({
    id: x.id,
    title: x.title,
    code: x.code,
    status: x.status,
    is_demo: x.is_demo,
    posted_by: x.posted_by,
  }));

  return (
    <ThemeStudio
      orgSlug={orgSlug}
      orgId={org.id}
      orgName={org.name}
      initialTheme={theme}
      themeList={themeList}
      currentUserId={user.id}
      canManageAll={isOrgAdmin}
    />
  );
}
