import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { MeForm } from "@/components/me/MeForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "マイページ — AI PM",
};

export default async function MePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/me");

  // プロフィール + 全 memberships (org 名/slug 付き)
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url, title, catchphrase, bio")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("memberships")
      .select(
        "id, role, affiliation, title, organization_id, organizations:organization_id(id, name, slug)",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  type Org = { id: string; name: string; slug: string };
  type Row = {
    id: string;
    role: "owner" | "admin" | "member" | "theme_owner";
    affiliation: string | null;
    title: string | null;
    organization_id: string;
    organizations: Org | Org[] | null;
  };

  const list = ((memberships ?? []) as unknown as Row[]).flatMap((m) => {
    const org = Array.isArray(m.organizations)
      ? m.organizations[0]
      : m.organizations;
    if (!org) return [];
    return [
      {
        id: m.id,
        org_id: org.id,
        org_name: org.name,
        org_slug: org.slug,
        role: m.role,
        affiliation: m.affiliation,
        title: m.title,
      },
    ];
  });

  return (
    <main className="px-6 py-6 md:px-7 md:py-7 max-w-3xl mx-auto">
      <header className="mb-4">
        <Link href="/orgs" className="t-cap underline">
          ← 組織一覧へ
        </Link>
        <h1 className="t-h2 mt-2">
          <span aria-hidden className="mr-2">
            👤
          </span>
          マイページ
        </h1>
        <p className="t-cap mt-1">アイコン / 氏名 / メアド / パスワード / 各組織での所属・肩書き</p>
      </header>

      <MeForm
        email={user.email ?? ""}
        displayName={profile?.display_name ?? null}
        avatarUrl={profile?.avatar_url ?? null}
        title={profile?.title ?? null}
        catchphrase={profile?.catchphrase ?? null}
        bio={profile?.bio ?? null}
        memberships={list}
      />
    </main>
  );
}
