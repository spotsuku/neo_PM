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

  const realAdmin = my?.role === "owner" || my?.role === "admin";
  // メンバー / テーマオーナー視点プレビュー中は管理者特権を外す
  const cookieStore = await cookies();
  const viewAs = cookieStore.get("neo:view-as")?.value;
  const isOrgAdmin =
    realAdmin && viewAs !== "member" && viewAs !== "theme_owner";

  // 一覧は「自分が作成したテーマ + 見本」のみ。管理者でも他人のテーマは一覧に出さず、
  // 編集もできない。他人の申請テーマは下の審査キューから開いてプレビュー+審査する。
  const { data: myThemes } = await supabase
    .from("themes")
    .select("*")
    .eq("organization_id", org.id)
    .or(`posted_by.eq.${user.id},is_demo.eq.true`)
    .order("is_demo", { ascending: true })
    .order("created_at", { ascending: false });
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

    const lastProjectCookie = cookieStore.get(
      `neo:last-project-id:${orgSlug}`,
    )?.value;
    const currentProjectId = explicitProjectId ?? lastProjectCookie ?? null;

    // 項目別の審査結果。審査中(submitted)=審査パネルの初期値 /
    // 記載中(draft)・差し戻し(changes_requested)=出題者へのフィードバック表示に使う。
    // review_decisions は項目ごとに永続保存 (upsert) されるので、記載中に
    // 戻しても前回の差し戻しコメントは残り続ける。
    const { data: decisions } =
      theme.status === "draft" ||
      theme.status === "submitted" ||
      theme.status === "changes_requested"
        ? await supabase
            .from("review_decisions")
            .select("item_key, decision, comment")
            .eq("target_type", "theme")
            .eq("target_id", theme.id)
        : { data: null };
    const reviewDecisions = (decisions ?? []) as {
      item_key: string;
      decision: "approved" | "changes_requested";
      comment: string | null;
    }[];
    const reviewComments = reviewDecisions
      .filter((d) => d.decision === "changes_requested")
      .map((d) => ({ item_key: d.item_key, comment: d.comment }));

    return (
      <ThemeStudio
        orgSlug={orgSlug}
        orgId={org.id}
        orgName={org.name}
        initialTheme={theme}
        currentUserId={user.id}
        canManageAll={isOrgAdmin}
        currentProjectId={currentProjectId}
        reviewComments={reviewComments}
        reviewDecisions={reviewDecisions}
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
