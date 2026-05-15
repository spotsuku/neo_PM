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

  // memberships / invitations / profiles を並列に取得し、JOIN はアプリ側で行う
  // (embed 構文 profiles:user_id(...) は FK 推論次第で空配列を返す可能性があり、
  //  自分自身も見えなくなる現象の原因になり得るため切り離す)
  const [
    { data: memberships, error: memErr },
    { data: invitations },
  ] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, role, user_id, affiliation, title, created_at")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("invitations")
      .select("*")
      .eq("organization_id", org.id)
      .is("used_at", null)
      .order("created_at", { ascending: false }),
  ]);
  if (memErr) {
    console.error("[members page] memberships error", memErr);
  }

  const memberRows = memberships ?? [];
  const userIds = memberRows.map((m) => m.user_id);
  const { data: profiles } =
    userIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", userIds)
      : { data: [] as { id: string; display_name: string | null; avatar_url: string | null }[] };

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id, p]),
  );
  const members = memberRows.map((m) => {
    const prof = profileById.get(m.user_id);
    return {
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      affiliation: m.affiliation,
      title: m.title,
      created_at: m.created_at,
      display_name: prof?.display_name ?? null,
      avatar_url: prof?.avatar_url ?? null,
      isMe: m.user_id === user.id,
    };
  });

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <header>
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
      </header>

      <nav className="flex items-center gap-1.5 flex-wrap">
        <Link
          href={`/${orgSlug}/settings`}
          className="rounded-full bg-white text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)] px-3 py-1.5 text-[11.5px] font-semibold"
        >
          ⚙️ 組織情報
        </Link>
        <Link
          href={`/${orgSlug}/settings/members`}
          className="rounded-full bg-ink text-white px-3 py-1.5 text-[11.5px] font-semibold"
        >
          👥 メンバー
        </Link>
        {(myMembership.role === "owner" || myMembership.role === "admin") && (
          <Link
            href={`/${orgSlug}/settings/members/bulk`}
            className="rounded-full bg-white text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)] px-3 py-1.5 text-[11.5px] font-semibold"
          >
            📋 一括招待
          </Link>
        )}
      </nav>

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
