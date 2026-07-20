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

  // 出題できるのは admin / owner / theme_owner。
  // 共同編集者 / 閲覧者として招かれているメンバーは canPost=false でも
  // /theme リストおよび ?t=<id> で個別テーマを開ける (下記の collaboratedThemes で
  // 表示する。RLS が許可した行だけ表示される)。
  // 「+ 新規テーマ作成」ボタンは canPost で制御する (ThemeOwnerHome に渡す)。
  const { data: my } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!my) {
    return (
      <div className="p-8 text-error">
        この組織のメンバーではありません。
      </div>
    );
  }
  const canPost =
    my.role === "owner" || my.role === "admin" || my.role === "theme_owner";

  const realAdmin = my?.role === "owner" || my?.role === "admin";
  // メンバー / テーマオーナー視点プレビュー中は管理者特権を外す
  const cookieStore = await cookies();
  const viewAs = cookieStore.get("neo:view-as")?.value;
  const isOrgAdmin =
    realAdmin && viewAs !== "member" && viewAs !== "theme_owner";

  // 一覧は「自分が作成したテーマ + 見本」+「共同編集者/閲覧者として呼ばれているテーマ」。
  // 管理者でも他人のテーマは "あなたの出題" には出さず、編集もできない
  // (admin は下の "他の出題者の編集中テーマ" / "審査待ち" から開く)。
  const { data: myThemes } = await supabase
    .from("themes")
    .select("*")
    .eq("organization_id", org.id)
    .or(`posted_by.eq.${user.id},is_demo.eq.true`)
    .neq("status", "archived") // アーカイブ済は隠す
    .order("is_demo", { ascending: true })
    .order("created_at", { ascending: false });
  const ownThemes = myThemes ?? [];

  // 共同編集者 / 閲覧者として紐付いているテーマ (自分の出題と重複しないもの)
  const { data: myCollabRows } = await supabase
    .from("theme_collaborators")
    .select("theme_id, role")
    .eq("user_id", user.id);
  const collabRoleById = new Map<string, "editor" | "viewer">(
    (myCollabRows ?? []).map((r) => [r.theme_id, r.role as "editor" | "viewer"]),
  );
  const collabIdsToFetch = Array.from(collabRoleById.keys()).filter(
    (id) => !ownThemes.some((t) => t.id === id),
  );
  const { data: collabThemesData } =
    collabIdsToFetch.length > 0
      ? await supabase
          .from("themes")
          .select("*")
          .eq("organization_id", org.id)
          .in("id", collabIdsToFetch)
          .order("created_at", { ascending: false })
      : { data: [] as typeof ownThemes };
  const collaboratedThemes = collabThemesData ?? [];

  // ?t= 切替用のソース (own + collab を結合した検索対象)
  const themes = [...ownThemes, ...collaboratedThemes];

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

    // ── 共同編集者 / 閲覧者と、追加候補 (org メンバー) を server で取得 ──
    const [{ data: collabRows }, { data: orgMembersRows }] = await Promise.all([
      supabase
        .from("theme_collaborators")
        .select("id, user_id, role")
        .eq("theme_id", theme.id),
      supabase
        .from("memberships")
        .select("user_id, role")
        .eq("organization_id", org.id),
    ]);
    const collabIds = (collabRows ?? []).map((c) => c.user_id);
    const memberIds = (orgMembersRows ?? []).map((m) => m.user_id);
    const profileIds = Array.from(new Set([...collabIds, ...memberIds]));
    const { data: profileRows } =
      profileIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, display_name, avatar_url")
            .in("id", profileIds)
        : { data: [] as { id: string; display_name: string | null; avatar_url: string | null }[] };
    const profileById = new Map(
      (profileRows ?? []).map((p) => [p.id, p]),
    );
    const collaborators = (collabRows ?? []).map((c) => {
      const p = profileById.get(c.user_id);
      return {
        id: c.id,
        user_id: c.user_id,
        role: c.role as "editor" | "viewer",
        display_name: p?.display_name ?? null,
        avatar_url: p?.avatar_url ?? null,
      };
    });
    const orgMembers = (orgMembersRows ?? []).map((m) => {
      const p = profileById.get(m.user_id);
      return {
        user_id: m.user_id,
        display_name: p?.display_name ?? null,
        avatar_url: p?.avatar_url ?? null,
      };
    });
    // 採点者選択候補: owner/admin のみ (審査画面で「採点者:」ドロップダウンに使う)
    const orgAdmins = (orgMembersRows ?? [])
      .filter((m) => m.role === "owner" || m.role === "admin")
      .map((m) => {
        const p = profileById.get(m.user_id);
        return {
          user_id: m.user_id,
          display_name: p?.display_name ?? null,
        };
      });
    const isCollaboratorEditor = collaborators.some(
      (c) => c.user_id === user.id && c.role === "editor",
    );
    const canManageCollaborators =
      isOrgAdmin || theme.posted_by === user.id;

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
        collaborators={collaborators}
        orgMembers={orgMembers}
        orgAdmins={orgAdmins}
        isCollaboratorEditor={isCollaboratorEditor}
        canManageCollaborators={canManageCollaborators}
      />
    );
  }

  // ── 一覧表示 (既定) ──────────────────────────────────────
  const toCard = (t: (typeof ownThemes)[number]): ThemeCard => ({
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
  });
  const cards: ThemeCard[] = ownThemes.map(toCard);
  const collabCards: (ThemeCard & {
    collabRole: "editor" | "viewer";
  })[] = collaboratedThemes.map((t) => ({
    ...toCard(t),
    collabRole: collabRoleById.get(t.id) ?? "viewer",
  }));

  // 管理者: 審査待ち (submitted) を組織横断で取得
  let reviewQueue: ReviewQueueItem[] = [];
  // 管理者: 他の出題者が編集中 (draft / changes_requested) のテーマ
  let othersEditingQueue: ReviewQueueItem[] = [];
  // 管理者: 他の出題者が承認済み / 公開中 のテーマ (approved / active)
  let othersPublishedQueue: ReviewQueueItem[] = [];
  if (isOrgAdmin) {
    const [{ data: pending }, { data: editing }, { data: published }] =
      await Promise.all([
        supabase
          .from("themes")
          .select("id, code, title, company_name, submitted_at")
          .eq("organization_id", org.id)
          .eq("status", "submitted")
          .order("submitted_at", { ascending: true }),
        supabase
          .from("themes")
          .select(
            "id, code, title, company_name, submitted_at, status, updated_at",
          )
          .eq("organization_id", org.id)
          .in("status", ["draft", "changes_requested"])
          .neq("posted_by", user.id)
          .eq("is_demo", false)
          .order("updated_at", { ascending: false }),
        supabase
          .from("themes")
          .select(
            "id, code, title, company_name, submitted_at, status, updated_at",
          )
          .eq("organization_id", org.id)
          .in("status", ["approved", "active"])
          .neq("posted_by", user.id)
          .eq("is_demo", false)
          .order("updated_at", { ascending: false }),
      ]);
    reviewQueue = (pending ?? []) as ReviewQueueItem[];
    othersEditingQueue = (editing ?? []) as ReviewQueueItem[];
    othersPublishedQueue = (published ?? []) as ReviewQueueItem[];
  }

  return (
    <ThemeOwnerHome
      orgSlug={orgSlug}
      orgId={org.id}
      orgName={org.name}
      currentUserId={user.id}
      isAdmin={isOrgAdmin}
      canPost={canPost}
      themes={cards}
      reviewQueue={reviewQueue}
      othersEditingQueue={othersEditingQueue}
      othersPublishedQueue={othersPublishedQueue}
      collaboratedThemes={collabCards}
    />
  );
}
