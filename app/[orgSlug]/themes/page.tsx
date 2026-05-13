import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { ThemeBrowse } from "@/components/themes/ThemeBrowse";
import { GlassCard } from "@/components/ui/GlassCard";

export const dynamic = "force-dynamic";

export default async function ThemesBrowsePage({
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

  // 公開中（active）テーマだけを表示
  const { data: themes } = await supabase
    .from("themes")
    .select("*")
    .eq("organization_id", org.id)
    .eq("status", "active")
    .order("deadline", { ascending: true, nullsFirst: false });

  // 自分の応募（応募ステータス表示用）
  const themeIds = (themes ?? []).map((t) => t.id);
  const { data: myApps } = user
    ? await supabase
        .from("theme_applications")
        .select("id, theme_id, status")
        .eq("applicant_user_id", user.id)
        .in("theme_id", themeIds.length > 0 ? themeIds : ["__none__"])
    : { data: [] };

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <GlassCard className="p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span
            className="grid h-12 w-12 place-items-center rounded-2xl text-white text-xl"
            style={{
              background:
                "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
            }}
          >
            🎯
          </span>
          <div>
            <h1 className="text-[18px] font-extrabold tracking-tight">
              テーマに応募
            </h1>
            <p className="t-cap">
              {org.name} ・ 公開中テーマ {themes?.length ?? 0} 件
            </p>
          </div>
        </div>
        <Link
          href={`/${orgSlug}/themes/applications`}
          className="rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)]"
        >
          📋 自分の応募を見る
        </Link>
      </GlassCard>

      <ThemeBrowse
        orgSlug={orgSlug}
        themes={themes ?? []}
        myApps={myApps ?? []}
      />
    </div>
  );
}
