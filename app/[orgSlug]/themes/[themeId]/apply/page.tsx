import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { ApplicationForm } from "@/components/themes/ApplicationForm";
import { GlassCard } from "@/components/ui/GlassCard";

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

  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const { data: theme } = await supabase
    .from("themes")
    .select("*")
    .eq("id", themeId)
    .maybeSingle();
  if (!theme) notFound();

  const { data: existing } = await supabase
    .from("theme_applications")
    .select("*")
    .eq("theme_id", themeId)
    .eq("applicant_user_id", user.id)
    .maybeSingle();

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <header>
        <Link href={`/${orgSlug}/themes`} className="t-cap underline">
          ← テーマ一覧へ戻る
        </Link>
      </header>

      <GlassCard className="p-0 overflow-hidden">
        <div
          className="aspect-[16/9] max-h-[180px] flex items-center justify-center text-4xl"
          style={
            theme.thumbnail_url
              ? {
                  backgroundImage: `url(${theme.thumbnail_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {
                  background:
                    "linear-gradient(135deg, var(--c-accent-soft), var(--c-accent-bright))",
                }
          }
        >
          {!theme.thumbnail_url && <span aria-hidden>📣</span>}
        </div>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {theme.code && (
              <span className="t-mono text-[11px] text-mute">{theme.code}</span>
            )}
            {theme.company_name && (
              <span className="t-cap">主催: {theme.company_name}</span>
            )}
          </div>
          <h1 className="text-[20px] font-extrabold tracking-tight mb-3">
            {theme.title}
          </h1>
          {theme.background && (
            <p className="text-[13px] leading-relaxed mb-3">
              {theme.background}
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 t-cap">
            {theme.deadline && (
              <span>
                📅 締切:{" "}
                {new Date(theme.deadline).toLocaleDateString("ja-JP")}
              </span>
            )}
            {theme.prize && <span>🎁 特典: {theme.prize}</span>}
            {theme.who_target && <span>🎯 対象: {theme.who_target}</span>}
            {theme.what_uniqueness && (
              <span>✨ 独自性: {theme.what_uniqueness}</span>
            )}
          </div>
        </div>
      </GlassCard>

      <ApplicationForm
        orgSlug={orgSlug}
        themeId={themeId}
        applicantUserId={user.id}
        applicantOrgId={org.id}
        initial={existing ?? null}
        defaultTeamName={
          (user.user_metadata?.display_name as string | undefined) ??
          user.email?.split("@")[0] ??
          ""
        }
      />
    </div>
  );
}
