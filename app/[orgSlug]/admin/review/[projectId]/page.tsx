import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  ItemReviewBoard,
  type ReviewItem,
} from "@/components/admin/ItemReviewBoard";

export const dynamic = "force-dynamic";

const FIELD_ITEMS: { key: string; label: string; emoji: string }[] = [
  { key: "why", label: "なぜ・誰のために", emoji: "💡" },
  { key: "who", label: "誰の・どんな状況", emoji: "👥" },
  { key: "what", label: "提供価値", emoji: "💎" },
  { key: "how", label: "実現方法", emoji: "🛠️" },
  { key: "product", label: "Product（提供物）", emoji: "🎁" },
  { key: "price", label: "Price（対価設計）", emoji: "🏷️" },
  { key: "place", label: "Place（実施場所）", emoji: "📍" },
  { key: "promotion", label: "Promotion（認知）", emoji: "📣" },
  { key: "goal", label: "目標（定性）", emoji: "🎯" },
  { key: "kpi", label: "KPI", emoji: "📊" },
];

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
    .select("id, name, team_name")
    .eq("id", projectId)
    .eq("organization_id", org.id)
    .maybeSingle();
  if (!project) notFound();

  const { data: plan } = await supabase
    .from("execution_plans")
    .select(
      "id, why, who, what, how, product, price, place, promotion, qualitative_goal",
    )
    .eq("project_id", projectId)
    .maybeSingle();

  let kpiText = "";
  if (plan?.id) {
    const { data: kpis } = await supabase
      .from("kpis")
      .select("label, target, unit, progress")
      .eq("plan_id", plan.id);
    kpiText = (kpis ?? [])
      .map(
        (k) =>
          `・${k.label ?? ""}${k.target != null ? ` 目標 ${k.target}${k.unit ?? ""}` : ""}（進捗 ${k.progress ?? 0}%）`,
      )
      .join("\n");
  }

  const contentByKey: Record<string, string> = {
    why: plan?.why ?? "",
    who: plan?.who ?? "",
    what: plan?.what ?? "",
    how: plan?.how ?? "",
    product: plan?.product ?? "",
    price: plan?.price ?? "",
    place: plan?.place ?? "",
    promotion: plan?.promotion ?? "",
    goal: plan?.qualitative_goal ?? "",
    kpi: kpiText,
  };
  const items: ReviewItem[] = FIELD_ITEMS.map((f) => ({
    ...f,
    content: contentByKey[f.key] ?? "",
  }));

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
