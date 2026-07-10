import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { FieldworkDetail } from "@/components/fieldworks/FieldworkDetail";

export const dynamic = "force-dynamic";

export default async function FieldworkDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>;
}) {
  const { orgSlug, id } = await params;
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

  const { data: fw } = await supabase
    .from("fieldworks")
    .select("*")
    .eq("id", id)
    .eq("organization_id", org.id)
    .maybeSingle();
  if (!fw) notFound();

  const isCreator = fw.created_by === user.id;

  // draft は作成者と admin のみ閲覧可能
  if (fw.status === "draft" && !isCreator && !isAdmin) {
    notFound();
  }

  // テーマ情報
  const { data: theme } = await supabase
    .from("themes")
    .select("id, title, code, company_name")
    .eq("id", fw.theme_id)
    .maybeSingle();

  // 参加者一覧
  const { data: participants } = await supabase
    .from("fieldwork_participants")
    .select("user_id, applied_at, motivation, transportation")
    .eq("fieldwork_id", fw.id)
    .order("applied_at", { ascending: true });

  const userIds = (participants ?? []).map((p) => p.user_id);
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

  const participantList = (participants ?? []).map((p) => {
    const prof = profileById.get(p.user_id);
    return {
      user_id: p.user_id,
      display_name: prof?.display_name ?? null,
      avatar_url: prof?.avatar_url ?? null,
      applied_at: p.applied_at,
      motivation: p.motivation,
      transportation: p.transportation,
      is_me: p.user_id === user.id,
    };
  });

  const myParticipation = participantList.find((p) => p.is_me) ?? null;

  return (
    <FieldworkDetail
      orgSlug={orgSlug}
      currentUserId={user.id}
      isAdmin={isAdmin}
      isCreator={isCreator}
      fieldwork={{
        id: fw.id,
        title: fw.title,
        theme_id: fw.theme_id,
        theme_title: theme?.title ?? "(削除されたテーマ)",
        theme_company: theme?.company_name ?? null,
        owner_name: fw.owner_name,
        meeting_place: fw.meeting_place,
        address: fw.address,
        meeting_at: fw.meeting_at,
        timeline: fw.timeline,
        what_you_gain: fw.what_you_gain,
        what_to_bring: fw.what_to_bring,
        dress_code: fw.dress_code,
        rain_plan: fw.rain_plan,
        cancellation_policy: fw.cancellation_policy,
        fee_yen: fw.fee_yen,
        capacity: fw.capacity,
        application_deadline: fw.application_deadline,
        thumbnail_url: fw.thumbnail_url,
        status: fw.status,
      }}
      participants={participantList}
      myParticipation={myParticipation}
    />
  );
}
