import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { MembersPanel } from "@/components/settings/MembersPanel";
import { GlassCard } from "@/components/ui/GlassCard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "メンバー — NEO PM",
};

export default async function MembersPage({
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

  // 自分の role
  const { data: myMembership } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!myMembership) notFound();

  // メンバー一覧（profiles 経由で display_name / avatar を取得）
  const { data: memberships } = await supabase
    .from("memberships")
    .select(
      "id, role, user_id, created_at, profiles:user_id(display_name, avatar_url)",
    )
    .eq("organization_id", org.id)
    .order("created_at", { ascending: true });

  const { data: invitations } = await supabase
    .from("invitations")
    .select("*")
    .eq("organization_id", org.id)
    .is("used_at", null)
    .order("created_at", { ascending: false });

  type ProfileShape = {
    display_name: string | null;
    avatar_url: string | null;
  };
  type MembershipRow = {
    id: string;
    role: "owner" | "admin" | "member";
    user_id: string;
    created_at: string;
    profiles: ProfileShape | ProfileShape[] | null;
  };

  const members = ((memberships ?? []) as unknown as MembershipRow[]).map((m) => {
    const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      created_at: m.created_at,
      display_name: prof?.display_name ?? null,
      avatar_url: prof?.avatar_url ?? null,
      isMe: m.user_id === user.id,
    };
  });

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div>
          <Link href={`/${orgSlug}`} className="t-cap underline">
            ← {org.name} に戻る
          </Link>
          <h1 className="t-h2 mt-2">
            <span aria-hidden className="mr-2">
              👥
            </span>
            メンバー設定
          </h1>
          <p className="t-cap mt-1">
            {org.name} — {members.length} 名のメンバー
          </p>
        </div>
      </header>

      <MembersPanel
        orgSlug={orgSlug}
        orgId={org.id}
        orgName={org.name}
        myRole={myMembership.role}
        members={members}
        initialInvitations={invitations ?? []}
      />

      <GlassCard className="p-4">
        <h3 className="t-h3 mb-2">
          <span aria-hidden className="mr-2">
            💡
          </span>
          メンバー追加のヒント
        </h3>
        <ul className="text-[12.5px] leading-relaxed text-mute space-y-1.5">
          <li>・招待リンクは1人につき1回だけ使えます。複数人を招くなら人数分発行してください。</li>
          <li>・リンク自体は誰でも踏めますが、踏んだ人のアカウントにだけメンバーシップが追加されます。</li>
          <li>・誤って共有してしまったら、リンクを取り消し → 再発行できます。</li>
          <li>・有効期限は発行から 14 日間です。</li>
        </ul>
      </GlassCard>
    </div>
  );
}
