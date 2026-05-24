import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { getMyProjectAccess } from "@/lib/projects";
import { getProjectViewableOrNotFound } from "@/lib/getProject";
import { GlassCard } from "@/components/ui/GlassCard";
import { PublishApplicationForm } from "@/components/projects/PublishApplicationForm";
import type { PublishApp } from "@/lib/publishFields";

export const dynamic = "force-dynamic";

export default async function PublishPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const supabase = await createClient();
  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) {
    return <div className="p-8 text-error">組織が見つかりません</div>;
  }

  const current = await getProjectViewableOrNotFound(supabase, org.id, projectId);
  const access = await getMyProjectAccess(supabase, org.id, projectId);
  // 公開申請はリード / 管理者のみ
  if (access !== "manage") {
    return (
      <GlassCard className="p-10 grid place-items-center text-center">
        <div className="max-w-md">
          <div className="text-5xl mb-3">🔒</div>
          <h2 className="t-h2 mb-2">公開申請の権限がありません</h2>
          <p className="t-cap leading-relaxed">
            ホームへの公開申請は、プロジェクトのリードまたは組織管理者のみが行えます。
          </p>
          <Link
            href={`/${orgSlug}/projects/${projectId}/dashboard`}
            className="mt-4 inline-block rounded-full bg-ink px-5 py-2 text-[12.5px] font-bold text-white"
          >
            ダッシュボードへ →
          </Link>
        </div>
      </GlassCard>
    );
  }

  const { data: plan } = await supabase
    .from("execution_plans")
    .select("why, who, what, qualitative_goal, idea_summary")
    .eq("project_id", projectId)
    .maybeSingle();

  const saved = (current.publish_app ?? {}) as PublishApp;
  // 既存内容を引用しつつ、保存済み申請があればそれを優先
  const initial: PublishApp = {
    image_url: saved.image_url ?? current.thumbnail_url ?? "",
    title: saved.title ?? current.team_name ?? current.name ?? "",
    summary:
      saved.summary ??
      current.idea_title ??
      plan?.idea_summary ??
      plan?.qualitative_goal ??
      "",
    why: saved.why ?? plan?.why ?? "",
    who: saved.who ?? plan?.who ?? "",
    problem: saved.problem ?? "",
    what: saved.what ?? plan?.what ?? "",
    outcome: saved.outcome ?? plan?.qualitative_goal ?? "",
    uniqueness: saved.uniqueness ?? "",
  };

  return (
    <PublishApplicationForm
      orgSlug={orgSlug}
      projectId={projectId}
      visibility={current.visibility}
      initial={initial}
    />
  );
}
