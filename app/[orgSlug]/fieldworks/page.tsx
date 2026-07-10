import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { FieldworksBoard } from "@/components/fieldworks/FieldworksBoard";
import { GlassCard } from "@/components/ui/GlassCard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "フィールドワーク — AI PM",
};

export default async function FieldworksPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const { data: myMembership } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!myMembership) notFound();

  const isAdmin =
    myMembership.role === "owner" || myMembership.role === "admin";
  const isThemeOwner = myMembership.role === "theme_owner";
  // フィールドワーク作成できる人 = org admin / theme_owner (テーマ紐付けが必須)
  const canCreate = isAdmin || isThemeOwner;

  if (!org.competition_enabled) {
    return (
      <GlassCard className="p-8 text-center flex flex-col gap-3">
        <span aria-hidden className="text-3xl">
          🔒
        </span>
        <h1 className="text-[18px] font-extrabold">
          この組織では「フィールドワーク」を利用できません
        </h1>
        <p className="t-cap">
          テーマ応募機能 (competition mode) を有効にした組織のみ利用できます。
        </p>
      </GlassCard>
    );
  }

  // 選択候補になる公開中テーマ (作成時に紐付ける)
  const { data: themes } = await supabase
    .from("themes")
    .select("id, title, code, posted_by")
    .eq("organization_id", org.id)
    .in("status", ["approved", "active"])
    .order("created_at", { ascending: false });

  // フィールドワーク一覧 (draft は作成者のみ表示するため一旦全部取得してから絞る)
  const { data: fieldworksRaw } = await supabase
    .from("fieldworks")
    .select(
      "id, title, theme_id, owner_name, meeting_place, meeting_at, capacity, application_deadline, fee_yen, thumbnail_url, status, created_by, created_at",
    )
    .eq("organization_id", org.id)
    .order("meeting_at", { ascending: true, nullsFirst: false });

  const fieldworks = (fieldworksRaw ?? []).filter(
    (f) => f.status !== "draft" || f.created_by === user.id || isAdmin,
  );

  const fieldworkIds = fieldworks.map((f) => f.id);

  // 参加者データ (透明化: 全員が誰でも見える)
  const { data: participants } =
    fieldworkIds.length > 0
      ? await supabase
          .from("fieldwork_participants")
          .select("fieldwork_id, user_id, applied_at")
          .in("fieldwork_id", fieldworkIds)
      : {
          data: [] as {
            fieldwork_id: string;
            user_id: string;
            applied_at: string;
          }[],
        };

  // profile
  const userIds = Array.from(
    new Set((participants ?? []).map((p) => p.user_id)),
  );
  const { data: profiles } =
    userIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", userIds)
      : {
          data: [] as {
            id: string;
            display_name: string | null;
            avatar_url: string | null;
          }[],
        };

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const themeById = new Map((themes ?? []).map((t) => [t.id, t]));

  const participantsByFw = new Map<
    string,
    {
      user_id: string;
      display_name: string | null;
      avatar_url: string | null;
      is_me: boolean;
    }[]
  >();
  for (const p of participants ?? []) {
    const arr = participantsByFw.get(p.fieldwork_id) ?? [];
    const prof = profileById.get(p.user_id);
    arr.push({
      user_id: p.user_id,
      display_name: prof?.display_name ?? null,
      avatar_url: prof?.avatar_url ?? null,
      is_me: p.user_id === user.id,
    });
    participantsByFw.set(p.fieldwork_id, arr);
  }

  const cards = fieldworks.map((f) => ({
    id: f.id,
    title: f.title,
    theme_title: themeById.get(f.theme_id)?.title ?? "(削除されたテーマ)",
    owner_name: f.owner_name,
    meeting_place: f.meeting_place,
    meeting_at: f.meeting_at,
    capacity: f.capacity,
    application_deadline: f.application_deadline,
    fee_yen: f.fee_yen,
    thumbnail_url: f.thumbnail_url,
    status: f.status,
    is_mine: f.created_by === user.id,
    participants: participantsByFw.get(f.id) ?? [],
  }));

  return (
    <FieldworksBoard
      orgSlug={orgSlug}
      orgId={org.id}
      orgName={org.name}
      currentUserId={user.id}
      canCreate={canCreate}
      isAdmin={isAdmin}
      themes={themes ?? []}
      fieldworks={cards}
    />
  );
}
