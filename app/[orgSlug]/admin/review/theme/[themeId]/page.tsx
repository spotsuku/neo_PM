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

export default async function ThemeReviewPage({
  params,
}: {
  params: Promise<{ orgSlug: string; themeId: string }>;
}) {
  const { orgSlug, themeId } = await params;
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

  const { data: t } = await supabase
    .from("themes")
    .select("*")
    .eq("id", themeId)
    .eq("organization_id", org.id)
    .maybeSingle();
  if (!t) notFound();

  const yn = (b: boolean | null) => (b ? "✓" : "✗");
  const resources = [
    t.resource_people && `人: ${t.resource_people}`,
    t.resource_place && `場所: ${t.resource_place}`,
    t.resource_budget && `予算: ${t.resource_budget}`,
    t.resource_data && `データ: ${t.resource_data}`,
    t.resource_other && `その他: ${t.resource_other}`,
  ]
    .filter(Boolean)
    .join("\n");

  const items: ReviewItem[] = [
    {
      key: "image",
      label: "サムネ画像",
      emoji: "🖼",
      content: t.thumbnail_url ? "" : "（画像が設定されていません）",
      image: t.thumbnail_url || undefined,
    },
    { key: "title", label: "課題テーマ", emoji: "🎯", content: t.title ?? "" },
    { key: "background", label: "背景", emoji: "📖", content: t.background ?? "" },
    { key: "who_target", label: "対象（誰の課題か）", emoji: "👥", content: t.who_target ?? "" },
    { key: "pain", label: "問題", emoji: "😣", content: t.pain ?? "" },
    { key: "what_uniqueness", label: "独自性", emoji: "💎", content: t.what_uniqueness ?? "" },
    { key: "what_benefit", label: "提供価値", emoji: "🎁", content: t.what_benefit ?? "" },
    { key: "how_hypothesis", label: "アプローチ仮説", emoji: "🛠️", content: t.how_hypothesis ?? "" },
    { key: "expected_outcome", label: "期待される成果", emoji: "📈", content: t.expected_outcome ?? "" },
    {
      key: "criteria",
      label: "3基準（地域 / 手段 / 若者）",
      emoji: "✅",
      content: `地域のためのテーマ: ${yn(t.criteria_region)}\n手段であって目的でない: ${yn(t.criteria_means)}\n若者が当事者として関われる: ${yn(t.criteria_youth)}`,
    },
    { key: "resources", label: "提供リソース", emoji: "🧰", content: resources },
  ];

  const { data: decisions } = await supabase
    .from("review_decisions")
    .select("item_key, decision, comment")
    .eq("target_type", "theme")
    .eq("target_id", themeId);
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
      targetType="theme"
      targetId={themeId}
      title={`テーマ審査 — ${t.title}`}
      items={items}
      initialDecisions={initialDecisions}
    />
  );
}
