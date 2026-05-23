import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { ThemeStudio } from "@/components/theme/ThemeStudio";
import {
  ThemeOwnerHome,
  type ThemeCard,
  type ReviewQueueItem,
} from "@/components/theme/ThemeOwnerHome";

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
    my?.role === "owner" || my?.role === "admin" || my?.role === "theme_owner";
  if (!canPost) {
    return (
      <div className="p-8 text-error">
        テーマ出題の権限がありません。テーマオーナーまたは管理者に依頼してください。
      </div>
    );
  }

  const isOrgAdmin = my?.role === "owner" || my?.role === "admin";

  // 自分のテーマ一覧 (admin は全部)。RLS でも下書きは本人/管理者のみに制限済み。
  const baseQuery = supabase
    .from("themes")
    .select("*")
    .eq("organization_id", org.id)
    .order("is_demo", { ascending: true })
    .order("created_at", { ascending: false });
  const { data: myThemes } = isOrgAdmin
    ? await baseQuery
    : await baseQuery.eq("posted_by", user.id);
  const themes = myThemes ?? [];

  // ── エディタ表示: ?t=<id> 指定時 ──────────────────────────
  if (explicitThemeId) {
    let theme = themes.find((x) => x.id === explicitThemeId) ?? null;
    // 一覧に無い (admin が他人の申請を開く等) 場合は単体取得
    if (!theme) {
      const { data: linked } = await supabase
        .from("themes")
        .select("*")
        .eq("id", explicitThemeId)
        .eq("organization_id", org.id)
        .maybeSingle();
      theme = linked ?? null;
    }
    if (!theme) {
      return (
        <div className="p-8 text-error">
          テーマが見つからないか、閲覧権限がありません。
        </div>
      );
    }

    // posted_by 補填 (旧データ)
    if (!theme.posted_by && theme.id) {
      await supabase
        .from("themes")
        .update({ posted_by: user.id })
        .eq("id", theme.id)
        .is("posted_by", null);
      theme = { ...theme, posted_by: user.id };
    }

    const cookieStore = await cookies();
    const lastProjectCookie = cookieStore.get(
      `neo:last-project-id:${orgSlug}`,
    )?.value;
    const currentProjectId = explicitProjectId ?? lastProjectCookie ?? null;

    return (
      <ThemeStudio
        orgSlug={orgSlug}
        orgId={org.id}
        orgName={org.name}
        initialTheme={theme}
        currentUserId={user.id}
        canManageAll={isOrgAdmin}
        currentProjectId={currentProjectId}
      />
    );
  }

  // ── 一覧表示 (既定) ──────────────────────────────────────
  const cards: ThemeCard[] = themes.map((t) => ({
    id: t.id,
    code: t.code,
    title: t.title,
    company_name: t.company_name,
    status: t.status,
    deadline: t.deadline,
    thumbnail_url: t.thumbnail_url,
    description_long: t.description_long,
    background: t.background,
    review_note: t.review_note,
    is_demo: t.is_demo,
  }));

  // 管理者: 審査待ち (submitted) を組織横断で取得
  let reviewQueue: ReviewQueueItem[] = [];
  if (isOrgAdmin) {
    const { data: pending } = await supabase
      .from("themes")
      .select("id, code, title, company_name, submitted_at")
      .eq("organization_id", org.id)
      .eq("status", "submitted")
      .order("submitted_at", { ascending: true });
    reviewQueue = (pending ?? []) as ReviewQueueItem[];
  }

  return (
    <ThemeOwnerHome
      orgSlug={orgSlug}
      orgId={org.id}
      orgName={org.name}
      currentUserId={user.id}
      isAdmin={isOrgAdmin}
      themes={cards}
      reviewQueue={reviewQueue}
    />
  );
}
