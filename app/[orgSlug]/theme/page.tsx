import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { ThemeBoard } from "@/components/theme/ThemeBoard";

export default async function ThemePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { orgSlug } = await params;
  const { id } = await searchParams;
  const supabase = await createClient();
  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) {
    return <div className="p-8 text-error">組織が見つかりません</div>;
  }

  const { data: themes } = await supabase
    .from("themes")
    .select("*")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });

  return (
    <ThemeBoard
      orgSlug={orgSlug}
      orgId={org.id}
      orgName={org.name}
      initialThemes={themes ?? []}
      activeId={id ?? null}
    />
  );
}
