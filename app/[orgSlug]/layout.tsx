import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { listUserOrgs } from "@/lib/orgs";
import { HeaderWithTab } from "@/components/shell/HeaderWithTab";
import { FloatingAI } from "@/components/ui/FloatingAI";
import { ViewAsBanner } from "@/components/shell/ViewAsBanner";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createClient();

  // 並列実行: orgs / 現在ユーザ / cookie
  const [orgs, userResp, cookieStore] = await Promise.all([
    listUserOrgs(supabase),
    supabase.auth.getUser(),
    cookies(),
  ]);

  const matched = orgs.find((o) => o.slug === orgSlug);
  if (!matched) notFound();

  const isAdmin = matched.role === "owner" || matched.role === "admin";
  const isThemeOwner = matched.role === "theme_owner";
  const competitionEnabled = matched.competition_enabled;
  const user = userResp.data.user;

  // プロジェクトアクセス判定: 並列化 + admin は組織 PJ 数チェックだけ
  let hasProjectAccess = false;
  if (user) {
    if (isAdmin) {
      const { count } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", matched.id);
      hasProjectAccess = (count ?? 0) > 0;
    } else {
      // 一般メンバー: project_memberships を引いて、その中に同 org の PJ があるか
      const { data: pms } = await supabase
        .from("project_memberships")
        .select("project_id")
        .eq("user_id", user.id);
      const ids = (pms ?? []).map((p) => p.project_id);
      if (ids.length > 0) {
        const { count } = await supabase
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", matched.id)
          .in("id", ids);
        hasProjectAccess = (count ?? 0) > 0;
      }
    }
  }

  // 管理者用「メンバー / テーマオーナー視点プレビュー」cookie
  const viewAs = cookieStore.get("neo:view-as")?.value;
  const previewAsMember = isAdmin && viewAs === "member";
  const previewAsThemeOwner = isAdmin && viewAs === "theme_owner";

  const effectiveHasAccess =
    previewAsMember || previewAsThemeOwner ? false : hasProjectAccess;
  const effectiveIsAdmin =
    previewAsMember || previewAsThemeOwner ? false : isAdmin;
  const effectiveIsThemeOwner = previewAsThemeOwner
    ? true
    : previewAsMember
      ? false
      : isThemeOwner;

  return (
    <>
      <HeaderWithTab
        orgSlug={orgSlug}
        orgs={orgs}
        hasProjectAccess={effectiveHasAccess}
        isAdmin={effectiveIsAdmin}
        isThemeOwner={effectiveIsThemeOwner}
        competitionEnabled={competitionEnabled}
      />
      {(previewAsMember || previewAsThemeOwner) && (
        <ViewAsBanner mode={previewAsThemeOwner ? "theme_owner" : "member"} />
      )}
      <main className="px-6 py-6 md:px-7 md:py-7 max-w-[1400px] mx-auto">
        {children}
      </main>
      <FloatingAI />
    </>
  );
}
