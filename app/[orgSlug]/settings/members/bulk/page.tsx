import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { BulkInviteBoard } from "@/components/settings/BulkInviteBoard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "一括招待 — NEO PM",
};

export default async function BulkInvitePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const { data: myMembership } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!myMembership) notFound();
  const canManage =
    myMembership.role === "owner" || myMembership.role === "admin";
  if (!canManage) {
    return (
      <div className="p-8 text-error">
        一括招待は owner / admin のみ利用できます。
      </div>
    );
  }

  const { data: invitations } = await supabase
    .from("invitations")
    .select("*")
    .eq("organization_id", org.id)
    .is("used_at", null)
    .order("created_at", { ascending: false });

  // /join/<token> の絶対 URL を組み立てるための origin を server で解決
  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const host = hdrs.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-4">
      <header>
        <Link
          href={`/${orgSlug}/settings/members`}
          className="t-cap underline"
        >
          ← メンバー設定に戻る
        </Link>
        <h1 className="t-h2 mt-2">
          <span aria-hidden className="mr-2">
            📋
          </span>
          一括招待
        </h1>
        <p className="t-cap mt-1">
          {org.name} — 100 名規模の招待を CSV ペーストで一気に発行できます
        </p>
      </header>

      <BulkInviteBoard
        orgId={org.id}
        orgName={org.name}
        origin={origin}
        initialBulk={invitations ?? []}
      />
    </div>
  );
}
