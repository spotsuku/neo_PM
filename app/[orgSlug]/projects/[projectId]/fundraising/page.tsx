import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { getProjectForOrgOrNotFound } from "@/lib/getProject";
import {
  FundraisingBoard,
  type CapData,
} from "@/components/fundraising/FundraisingBoard";

export const dynamic = "force-dynamic";

const EMPTY: CapData = { rounds: [], shareholders: [] };

export default async function FundraisingPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const supabase = await createClient();

  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  // 課金フラグのゲート (組織で資金調達が有効な時のみアクセス可)
  const { data: orgFund } = await supabase
    .from("organizations")
    .select("fundraising_enabled")
    .eq("id", org.id)
    .maybeSingle();
  if (!orgFund?.fundraising_enabled) notFound();

  const current = await getProjectForOrgOrNotFound(supabase, org.id, projectId);

  const { data: row } = await supabase
    .from("cap_tables")
    .select("data")
    .eq("project_id", current.id)
    .maybeSingle();

  const initialData = (row?.data as CapData | undefined) ?? EMPTY;

  return (
    <FundraisingBoard
      projectId={current.id}
      projectName={current.name}
      initialData={initialData}
    />
  );
}
