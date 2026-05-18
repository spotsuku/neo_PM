import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { ThemeStudio } from "@/components/theme/ThemeStudio";

export const dynamic = "force-dynamic";

export default async function ThemePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ t?: string; p?: string }>;
}) {
  const { orgSlug } = await params;
  const { t: explicitThemeId, p: explicitProjectId } = await searchParams;
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

  const isOrgAdmin = my?.role === "owner" || my?.role === "admin";

  // 現在のプロジェクト ID を URL ?p= → cookie の順で決定
  const cookieStore = await cookies();
  const lastProjectCookie = cookieStore.get(
    `neo:last-project-id:${orgSlug}`,
  )?.value;
  const currentProjectId = explicitProjectId ?? lastProjectCookie ?? null;

  // 現在 PJT に紐付くテーマ ID を取得
  let projectThemeId: string | null = null;
  let currentProjectName: string | null = null;
  if (currentProjectId) {
    const { data: proj } = await supabase
      .from("projects")
      .select("id, name, theme_id")
      .eq("id", currentProjectId)
      .eq("organization_id", org.id)
      .maybeSingle();
    projectThemeId = proj?.theme_id ?? null;
    currentProjectName = proj?.name ?? null;
  }

  // 自分のテーマ一覧 (or admin/owner なら全部)
  const themesQuery = supabase
    .from("themes")
    .select("*")
    .eq("organization_id", org.id)
    .order("is_demo", { ascending: true })
    .order("created_at", { ascending: false });
  const { data: myThemes } = isOrgAdmin
    ? await themesQuery
    : await themesQuery.eq("posted_by", user.id);

  // 表示するテーマを決定:
  //  1. ?t=<id> 明示指定
  //  2. project.theme_id (現在 PJT のテーマ) を優先
  //  3. 見本以外で最新
  //  4. 見本でも最新
  //  5. なし → null (空状態 = 新規作成プレースホルダー表示)
  let theme = null as (typeof myThemes extends (infer T)[] | null ? T : never) | null;
  if (myThemes && myThemes.length > 0) {
    if (explicitThemeId) {
      theme = myThemes.find((x) => x.id === explicitThemeId) ?? null;
    }
    if (!theme && projectThemeId) {
      theme = myThemes.find((x) => x.id === projectThemeId) ?? null;
      // myThemes に含まれない (= 自分のじゃない) 場合は別途取得
      if (!theme) {
        const { data: linked } = await supabase
          .from("themes")
          .select("*")
          .eq("id", projectThemeId)
          .eq("organization_id", org.id)
          .maybeSingle();
        if (linked) theme = linked;
      }
    }
    if (!theme) {
      theme = myThemes.find((x) => !x.is_demo) ?? myThemes[0] ?? null;
    }
  }

  // posted_by 補填
  if (theme && !theme.posted_by) {
    await supabase
      .from("themes")
      .update({ posted_by: user.id })
      .eq("id", theme.id)
      .is("posted_by", null);
    theme = { ...theme, posted_by: user.id };
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
      currentProjectId={currentProjectId}
      currentProjectName={currentProjectName}
    />
  );
}
