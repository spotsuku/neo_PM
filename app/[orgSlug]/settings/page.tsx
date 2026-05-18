import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { OrgGeneralForm } from "@/components/settings/OrgGeneralForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "組織情報 — NEO PM",
};

export default async function OrgSettingsPage({
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

  const { count: memberCount } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id);

  const { count: projectCount } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id);

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <header>
        <Link href={`/${orgSlug}`} className="t-cap underline">
          ← {org.name} に戻る
        </Link>
        <h1 className="t-h2 mt-2">
          <span aria-hidden className="mr-2">
            ⚙️
          </span>
          組織情報
        </h1>
        <p className="t-cap mt-1">
          チーム名・説明・アイコンを編集できます。
        </p>
      </header>

      {/* 設定ナビ */}
      <nav className="flex items-center gap-1.5 flex-wrap">
        <SettingsTab href={`/${orgSlug}/settings`} active>
          ⚙️ 組織情報
        </SettingsTab>
        <SettingsTab href={`/${orgSlug}/settings/members`}>
          👥 メンバー
        </SettingsTab>
      </nav>

      <OrgGeneralForm
        org={org}
        myRole={myMembership.role}
        memberCount={memberCount ?? 0}
        projectCount={projectCount ?? 0}
      />
    </div>
  );
}

function SettingsTab({
  href,
  active = false,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition " +
        (active
          ? "bg-ink text-white"
          : "bg-white text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)]")
      }
    >
      {children}
    </Link>
  );
}
