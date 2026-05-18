import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { ApplicationsBoard } from "@/components/themes/ApplicationsBoard";
import { GlassCard } from "@/components/ui/GlassCard";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/${orgSlug}/themes/applications`);

  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const { data: myMembership } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();
  const canReview =
    myMembership?.role === "owner" || myMembership?.role === "admin";

  // 自分の応募
  const { data: myApps } = await supabase
    .from("theme_applications")
    .select("*, themes:theme_id(id, code, title, thumbnail_url, organization_id)")
    .eq("applicant_user_id", user.id)
    .order("updated_at", { ascending: false });

  // この組織宛の受信応募（テーマがこの組織のもの、submitted 以降）
  const { data: orgThemes } = await supabase
    .from("themes")
    .select("id, code, title, thumbnail_url")
    .eq("organization_id", org.id);

  const orgThemeIds = (orgThemes ?? []).map((t) => t.id);
  const orgThemeById = new Map(
    (orgThemes ?? []).map((t) => [t.id, t]),
  );

  const { data: incoming } = orgThemeIds.length > 0
    ? await supabase
        .from("theme_applications")
        .select("*")
        .in("theme_id", orgThemeIds)
        .neq("status", "draft")
        .order("submitted_at", { ascending: false, nullsFirst: false })
    : { data: [] };

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <header>
        <Link href={`/${orgSlug}/themes`} className="t-cap underline">
          ← テーマ一覧へ戻る
        </Link>
        <h1 className="t-h2 mt-2">
          <span aria-hidden className="mr-2">
            📋
          </span>
          応募の管理
        </h1>
        <p className="t-cap mt-1">
          {org.name} ・ 自分の応募 {(myApps ?? []).length} 件
          {canReview && (
            <>・ 受信応募 {(incoming ?? []).length} 件</>
          )}
        </p>
      </header>

      <ApplicationsBoard
        orgSlug={orgSlug}
        orgId={org.id}
        canReview={canReview}
        myApps={
          (myApps ?? []).map((a) => {
            const raw = a as unknown as {
              themes:
                | { id: string; code: string | null; title: string; thumbnail_url: string | null }
                | { id: string; code: string | null; title: string; thumbnail_url: string | null }[]
                | null;
            };
            const t = Array.isArray(raw.themes)
              ? raw.themes[0] ?? null
              : raw.themes;
            return { ...a, theme: t };
          }) as never
        }
        incoming={(incoming ?? []).map((a) => ({
          ...a,
          theme: orgThemeById.get(a.theme_id) ?? null,
        })) as never}
      />

      <GlassCard className="p-4">
        <h3 className="t-h3 mb-2">
          <span aria-hidden className="mr-2">
            💡
          </span>
          応募フロー
        </h3>
        <ol className="text-[12.5px] leading-relaxed text-mute space-y-1">
          <li>1. 応募者：「📋 テーマ応募」でテーマを見つけ、「応募する」</li>
          <li>2. 応募者：下書き → 提案を書く → 「✦ 応募を送信」（最終確認あり）</li>
          <li>3. 主催 admin：この画面の「受信応募」タブで内容確認</li>
          <li>4. 主催 admin：「✓ 合格」or「✕ 不採択」+ コメント</li>
          <li>5. 合格時：自動でプロジェクトが組成され、応募者を lead として登録</li>
        </ol>
      </GlassCard>
    </div>
  );
}
