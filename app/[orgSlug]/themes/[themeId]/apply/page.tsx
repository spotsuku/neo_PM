import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { ApplicationForm } from "@/components/themes/ApplicationForm";

export const dynamic = "force-dynamic";

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ orgSlug: string; themeId: string }>;
}) {
  const { orgSlug, themeId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/${orgSlug}/themes/${themeId}/apply`);

  // 並列実行: org / theme / 既存応募
  const [org, themeResp, existingResp] = await Promise.all([
    getOrgBySlug(supabase, orgSlug),
    supabase.from("themes").select("*").eq("id", themeId).maybeSingle(),
    supabase
      .from("theme_applications")
      .select("*")
      .eq("theme_id", themeId)
      .eq("applicant_user_id", user.id)
      .maybeSingle(),
  ]);
  if (!org) notFound();
  const theme = themeResp.data;
  if (!theme) notFound();
  const existing = existingResp.data;

  // 採択済 + project_started_at が設定されているなら、応募者が
  // 既に project_memberships に居るかをチェック (居なければ「参加」ボタン表示)
  let applicantJoined = false;
  if (
    existing?.status === "approved" &&
    existing.created_project_id &&
    existing.project_started_at
  ) {
    const { data: pm } = await supabase
      .from("project_memberships")
      .select("user_id")
      .eq("project_id", existing.created_project_id)
      .eq("user_id", user.id)
      .maybeSingle();
    applicantJoined = Boolean(pm);
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <header>
        <Link
          href={`/${orgSlug}/themes/${themeId}`}
          className="t-cap underline"
        >
          ← テーマ詳細に戻る
        </Link>
        <h1 className="t-h2 mt-2">
          <span aria-hidden className="mr-2">
            ✦
          </span>
          応募申請: {theme.title}
        </h1>
        <p className="t-cap mt-1">
          チーム名・メンバー・提案内容を記入して応募してください
          {theme.company_name ? ` (主催: ${theme.company_name})` : ""}
        </p>
      </header>

      <ApplicationForm
        orgSlug={orgSlug}
        themeId={themeId}
        applicantUserId={user.id}
        applicantOrgId={org.id}
        initial={existing ?? null}
        applicantJoined={applicantJoined}
        defaultTeamName={
          (user.user_metadata?.display_name as string | undefined) ??
          user.email?.split("@")[0] ??
          ""
        }
      />
    </div>
  );
}
