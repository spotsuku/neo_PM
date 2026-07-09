import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { ensurePersonalOrg, listUserOrgs } from "@/lib/orgs";
import { JoinInvitedOrgCard } from "@/components/orgs/JoinInvitedOrgCard";
import type { Database } from "@/lib/types/database";

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
  const invitedSlugFromMeta =
    typeof meta.community_invited_org_slug === "string"
      ? meta.community_invited_org_slug
      : null;

  // 環境変数 fallback (metadata が未セットの stuck ユーザ救済用)
  const envCommunityOrgSlug =
    process.env.NEO_COMMUNITY_ORG_SLUG?.trim() || null;

  // 使う slug: metadata > env var
  const invitedSlug = invitedSlugFromMeta ?? envCommunityOrgSlug;

  let invitedOrg: {
    slug: string;
    name: string;
    description: string | null;
    emoji: string | null;
    iconUrl: string | null;
  } | null = null;
  // metadata が付いているなら確実に対象 / metadata 無しでも env var 経由で
  // カードは出す (join API 側でどのみち metadata 検証あり)
  const showInvitedCard =
    invitedSlug &&
    !orgs.some((o) => o.slug === invitedSlug) &&
    (communityVerified || !!envCommunityOrgSlug);
  if (showInvitedCard && invitedSlug) {
    // organizations テーブルの RLS は "is_org_member" なので、まだ未参加の
    // 招待対象 org は通常クライアントで読めない。service-role で読み取り。
    // (Join API 側で metadata を検証するのでセキュリティは維持)
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supaUrl && serviceKey) {
      const admin = createSupabaseClient<Database>(supaUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data } = await admin
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
  }

  // metadata 未更新のまま personal org だけになった stuck ユーザを検出
  // (env var 経由でカードは出せるが、community 経由の可能性を明示する)
  const needsCommunityRelogin =
    !communityVerified &&
    orgs.length === 1 &&
    !!envCommunityOrgSlug &&
    invitedOrg !== null;

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

        {/* metadata が未更新のまま personal org だけになった時の救済 */}
        {needsCommunityRelogin && (
          <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-[12.5px] text-amber-900 leading-relaxed">
            <strong>💡 参加ボタンを押しても弾かれる場合</strong>
            <br />
            community_dashboard 側での認証情報が最新でない可能性があります。
            もし上の「参加する」ボタンで
            <code className="mx-1 text-[11px]">community_dashboard 認証が必要です</code>
            のエラーが出た場合は、<a
              href="/login"
              className="underline font-semibold hover:text-ink"
            >
              ログイン画面
            </a>{" "}
            から「コミュニティポータルでログイン」をやり直してください。
          </div>
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
