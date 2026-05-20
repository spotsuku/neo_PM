import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { redirectToProjectScope } from "@/lib/redirectToProjectScope";

export default async function LegacyDiagRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { orgSlug } = await params;
  const { p } = await searchParams;
  const supabase = await createClient();
  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) return <div className="p-8 text-error">組織が見つかりません</div>;
  await redirectToProjectScope(
    supabase,
    { id: org.id, slug: orgSlug },
    p ?? null,
    "diag",
  );
}
