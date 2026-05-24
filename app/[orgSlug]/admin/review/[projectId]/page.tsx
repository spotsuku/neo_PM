import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  ItemReviewBoard,
  type ReviewItem,
} from "@/components/admin/ItemReviewBoard";
import { PUBLISH_FIELDS, type PublishApp } from "@/lib/publishFields";

export const dynamic = "force-dynamic";

export default async function ProjectReviewPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  // 管理者のみ
  const { data: myMembership } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (myMembership?.role !== "owner" && myMembership?.role !== "admin") {
    return (
      <div className="max-w-xl mx-auto">
        <GlassCard className="p-10 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="t-h2 mb-1">管理者専用ページ</h2>
          <Link href={`/${orgSlug}`} className="t-cap underline">
            ← 戻る
          </Link>
        </GlassCard>
      </div>
    );
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, team_name, publish_app")
    .eq("id", projectId)
    .eq("organization_id", org.id)
    .maybeSingle();
  if (!project) notFound();

  // 審査対象は「公開申請フォーム」の内容
  const app = (project.publish_app ?? {}) as PublishApp;
  const items: ReviewItem[] = [
    {
      key: "image",
      label: "サムネ画像",
      emoji: "🖼",
      content: app.image_url ? "" : "（画像が設定されていません）",
      image: app.image_url || undefined,
    },
    ...PUBLISH_FIELDS.map((f) => ({
      key: f.key,
      label: f.label,
      emoji: f.emoji,
      content: app[f.key] ?? "",
    })),
  ];

  const { data: decisions } = await supabase
    .from("review_decisions")
    .select("item_key, decision, comment")
    .eq("target_type", "project")
    .eq("target_id", projectId);
  const initialDecisions: Record<
    string,
    { decision: "approved" | "changes_requested"; comment: string | null }
  > = {};
  for (const d of decisions ?? []) {
    initialDecisions[d.item_key] = {
      decision: d.decision as "approved" | "changes_requested",
      comment: d.comment,
    };
  }

  return (
    <ItemReviewBoard
      orgSlug={orgSlug}
      targetType="project"
      targetId={projectId}
      title={`公開審査 — ${project.team_name ?? project.name}`}
      items={items}
      initialDecisions={initialDecisions}
    />
  );
}
