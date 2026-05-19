import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { listOrgProjects } from "@/lib/projects";
import { loadTimeline } from "@/lib/timeline";
import { HomeBoard } from "@/components/home/HomeBoard";

export default async function HomePage({
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

  // プロジェクト一覧 + アクセス情報
  const overview = await listOrgProjects(supabase, org.id);
  const { data: detail } = await supabase
    .from("projects")
    .select("*")
    .eq("organization_id", org.id)
    .order("progress_pct", { ascending: false });

  // 今週のクエスト (組織共通、active のみ)
  const today = new Date().toISOString().slice(0, 10);
  const { data: activeQuests } = await supabase
    .from("quests")
    .select("*, quest_items(*)")
    .eq("organization_id", org.id)
    .is("project_id", null)
    .eq("status", "active")
    .gte("ends_at", today)
    .order("ends_at", { ascending: true })
    .limit(1);

  type QuestWithItems = {
    id: string;
    title: string;
    emoji: string | null;
    ends_at: string;
    quest_items: {
      id: string;
      label: string;
      position: number;
      done_count: number;
      target_count: number;
    }[];
  };
  const currentQuest =
    (activeQuests?.[0] as QuestWithItems | undefined) ?? null;
  const daysLeft = currentQuest
    ? Math.max(
        0,
        Math.ceil(
          (new Date(currentQuest.ends_at).getTime() - Date.now()) /
            86400000,
        ),
      )
    : 0;
  const questItems = currentQuest
    ? [...currentQuest.quest_items].sort((a, b) => a.position - b.position)
    : [];

  // 横断タイムライン: アクセス可能なプロジェクトの投稿だけ
  // (RLS が can_access_project で制限してくれるので、ID 列挙だけしておく)
  const allProjectIds = (detail ?? []).map((p) => p.id);
  const timeline = await loadTimeline(supabase, allProjectIds, 30);

  // AI 総合評価をプロジェクト毎にバッチ算出 (ホームランキング用)
  const { computeBatchProjectScores } = await import("@/lib/projectScoreBatch");
  const scoreMap = await computeBatchProjectScores(
    supabase,
    (detail ?? []).map((p) => ({ id: p.id, streak_days: p.streak_days })),
  );
  const aiScoreById: Record<string, number> = {};
  scoreMap.forEach((v, k) => {
    aiScoreById[k] = v.total;
  });

  // 投稿可能なプロジェクト = manage または view 権限があるもの
  const accessibleProjects = overview
    .filter((o) => o.access !== "none")
    .map((o) => ({ id: o.id, name: o.name, team_name: o.team_name }));

  return (
    <HomeBoard
      orgSlug={orgSlug}
      orgName={org.name}
      currentUserId={user?.id ?? null}
      projects={(detail ?? []).map((p) => ({
        ...p,
        access: overview.find((o) => o.id === p.id)?.access ?? "none",
      }))}
      currentQuest={currentQuest}
      questItems={questItems}
      daysLeft={daysLeft}
      timelinePosts={timeline.posts}
      timelineAuthors={Array.from(timeline.authorsById.entries())}
      composeProjects={accessibleProjects}
      aiScoreById={aiScoreById}
    />
  );
}
