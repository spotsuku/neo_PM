import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ensurePersonalOrg, listUserOrgs } from "@/lib/orgs";
import { JoinInvitedOrgCard } from "@/components/orgs/JoinInvitedOrgCard";

export const metadata = {
  title: "組織を選択 — AI PM",
};

export default async function OrgsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Trigger 経由で自動作成されるはずだが、二重防御
  await ensurePersonalOrg(supabase).catch(() => null);
  const orgs = await listUserOrgs(supabase);

  // community_dashboard で認証済みのユーザ向け「参加できる組織」カードの準備
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const communityVerified = meta.community_verified === true;
  const invitedSlug =
    typeof meta.community_invited_org_slug === "string"
      ? meta.community_invited_org_slug
      : null;
  let invitedOrg: {
    slug: string;
    name: string;
    description: string | null;
    emoji: string | null;
    iconUrl: string | null;
  } | null = null;
  if (
    communityVerified &&
    invitedSlug &&
    !orgs.some((o) => o.slug === invitedSlug)
  ) {
    const { data } = await supabase
      .from("organizations")
      .select("slug, name, description, emoji, icon_url")
      .eq("slug", invitedSlug)
      .maybeSingle();
    if (data) {
      invitedOrg = {
        slug: data.slug,
        name: data.name,
        description: data.description,
        emoji: data.emoji,
        iconUrl: data.icon_url,
      };
    }
  }

  // 招待組織が表示できる場合は auto-redirect しない (ユーザに選ばせる)
  if (orgs.length === 1 && !invitedOrg) {
    redirect(`/${orgs[0].slug}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="glass-strong w-full max-w-xl p-8 md:p-10 animate-risein">
        <h1 className="t-h2 mb-2">どの組織で作業しますか？</h1>
        <p className="t-cap mb-6">
          所属している組織を選択するか、新しく作成してください。
        </p>

        {/* community_dashboard 経由のユーザ向け参加カード */}
        {invitedOrg && (
          <JoinInvitedOrgCard
            slug={invitedOrg.slug}
            name={invitedOrg.name}
            description={invitedOrg.description}
            emoji={invitedOrg.emoji}
            iconUrl={invitedOrg.iconUrl}
          />
        )}

        {/* 同名重複の警告 */}
        {(() => {
          const dupNames = Array.from(
            orgs
              .reduce((m, o) => m.set(o.name, (m.get(o.name) ?? 0) + 1), new Map<string, number>())
              .entries(),
          ).filter(([, c]) => c > 1).map(([n]) => n);
          if (dupNames.length === 0) return null;
          return (
            <div className="mb-5 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-[12.5px] leading-relaxed">
              <strong>⚠️ 同じ名前の組織が複数あります</strong>: {dupNames.join(", ")}
              <br />
              下の slug や作成日で見分けてください。不要なものは各組織の{" "}
              <code>設定 → 組織情報</code> から (owner なら) 削除、または{" "}
              <code>メンバー設定</code> から自分の所属を削除できます。
            </div>
          );
        })()}

        <ul className="flex flex-col gap-2 mb-6">
          {orgs.map((o) => {
            const sameName = orgs.filter((x) => x.name === o.name).length > 1;
            return (
              <li key={o.id}>
                <Link
                  href={`/${o.slug}`}
                  className="flex items-start gap-3 rounded-xl bg-white px-4 py-3 hover:bg-accent-soft transition border border-line lift"
                >
                  <span
                    className="grid h-10 w-10 place-items-center rounded-full text-white font-semibold flex-shrink-0 mt-[1px]"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
                    }}
                  >
                    {o.name[0]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {o.name}
                    </div>
                    <div className="t-cap t-mono opacity-70 truncate">
                      /{o.slug}
                      {sameName && (
                        <span className="ml-1.5 opacity-80">
                          ・
                          {new Date(o.created_at).toLocaleDateString("ja-JP")}
                        </span>
                      )}
                    </div>
                    <div className="t-cap mt-0.5">{o.role}</div>
                  </div>
                  <span aria-hidden className="t-cap mt-[2px]">
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <Link
          href="/orgs/new"
          className="block w-full rounded-xl border border-dashed border-line px-4 py-3 text-center text-sm font-medium text-mute hover:bg-accent-soft hover:text-[--c-accent-deep] hover:border-[--c-accent]"
        >
          ＋ 新しい組織を作成
        </Link>
      </div>
    </main>
  );
}
