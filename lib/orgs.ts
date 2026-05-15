import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

// @supabase/supabase-js v2.46+ uses 4+ generics with optional client-options.
// Skip the explicit Schema arg so it auto-resolves via Database["public"].
export type Client = SupabaseClient<Database>;

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9぀-ヿ一-鿿]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "team"
  );
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

/**
 * 初回サインイン時に呼び出す。既に membership があれば何もしない。
 * Postgres 側に trigger があれば不要だが、二重防御として client 側にも置く。
 */
export async function ensurePersonalOrg(supabase: Client) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1);

  if (existing && existing.length > 0) return existing[0];

  const baseName =
    (user.user_metadata?.name as string | undefined) ??
    user.email?.split("@")[0] ??
    "わたしのチーム";
  const name = `${baseName} のチーム`;
  const slug = `${slugify(baseName)}-${randomSuffix()}`;

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .insert({ name, slug })
    .select()
    .single();
  if (orgErr || !org) throw orgErr;

  const { error: memErr } = await supabase.from("memberships").insert({
    user_id: user.id,
    organization_id: org.id,
    role: "owner",
  });
  if (memErr) throw memErr;

  return { organization_id: org.id };
}

export async function listUserOrgs(supabase: Client) {
  // 重要: RLS の `user reads own memberships` ポリシーは
  //   user_id = auth.uid() OR public.is_org_member(organization_id)
  // なので、自分が所属している組織の "他人" の membership 行も SELECT 可能。
  // ここで user_id フィルタを忘れると、自分が member の組織にいる
  // 他メンバー分の行まで返ってきて、組織が複数あるように見えてしまう。
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("memberships")
    .select(
      "role, organizations:organization_id(id, name, slug, emoji, competition_enabled, created_at)",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  type RawOrg = {
    id: string;
    name: string;
    slug: string;
    emoji: string | null;
    competition_enabled: boolean;
    created_at: string;
  };
  type RawRow = {
    role: "owner" | "admin" | "member" | "theme_owner";
    organizations: RawOrg | RawOrg[] | null;
  };
  return ((data ?? []) as unknown as RawRow[]).flatMap((m) => {
    const org = Array.isArray(m.organizations)
      ? m.organizations[0]
      : m.organizations;
    return org
      ? [
          {
            id: org.id,
            name: org.name,
            slug: org.slug,
            emoji: org.emoji,
            competition_enabled: org.competition_enabled,
            created_at: org.created_at,
            role: m.role,
          },
        ]
      : [];
  });
}

export async function getOrgBySlug(supabase: Client, slug: string) {
  const { data } = await supabase
    .from("organizations")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}
