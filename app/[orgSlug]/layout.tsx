import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { listUserOrgs, getOrgBySlug } from "@/lib/orgs";
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
  const orgs = await listUserOrgs(supabase);

  const matched = orgs.find((o) => o.slug === orgSlug);
  if (!matched) notFound();

  const isAdmin = matched.role === "owner" || matched.role === "admin";
  const isThemeOwner = matched.role === "theme_owner";

  // この組織内でアクセス可能なプロジェクトが1つ以上あるか
  const org = await getOrgBySlug(supabase, orgSlug);
  let hasProjectAccess = false;
  if (org) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      if (isAdmin) {
        // 組織 admin/owner なら同組織のプロジェクトが1個でもあれば可
        const { count } = await supabase
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org.id);
        hasProjectAccess = (count ?? 0) > 0;
      } else {
        // 一般メンバーは project_memberships を確認
        const { data: pms } = await supabase
          .from("project_memberships")
          .select("project_id")
          .eq("user_id", user.id)
          .limit(1);
        // pms の project_id が同 org に属するか確認
        if (pms && pms.length > 0) {
          const { count } = await supabase
            .from("projects")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", org.id)
            .in(
              "id",
              pms.map((p) => p.project_id),
            );
          hasProjectAccess = (count ?? 0) > 0;
        }
      }
    }
  }

  // 管理者用「メンバー視点プレビュー」cookie
  const cookieStore = await cookies();
  const viewAs = cookieStore.get("neo:view-as")?.value;
  const previewAsMember = isAdmin && viewAs === "member";

  // effective アクセス（プレビュー中は false 扱い）
  const effectiveHasAccess = previewAsMember ? false : hasProjectAccess;
  const effectiveIsAdmin = previewAsMember ? false : isAdmin;
  const effectiveIsThemeOwner = previewAsMember ? false : isThemeOwner;

  return (
    <>
      <HeaderWithTab
        orgSlug={orgSlug}
        orgs={orgs}
        hasProjectAccess={effectiveHasAccess}
        isAdmin={effectiveIsAdmin}
        isThemeOwner={effectiveIsThemeOwner}
      />
      {previewAsMember && <ViewAsBanner />}
      <main className="px-6 py-6 md:px-7 md:py-7 max-w-[1400px] mx-auto">
        {children}
      </main>
      <FloatingAI />
    </>
  );
}
