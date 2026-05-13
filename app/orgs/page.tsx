import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ensurePersonalOrg, listUserOrgs } from "@/lib/orgs";

export const metadata = {
  title: "組織を選択 — NEO PM",
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

  if (orgs.length === 1) {
    redirect(`/${orgs[0].slug}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="glass-strong w-full max-w-xl p-8 md:p-10 animate-risein">
        <h1 className="t-h2 mb-2">どの組織で作業しますか？</h1>
        <p className="t-cap mb-6">
          所属している組織を選択するか、新しく作成してください。
        </p>

        <ul className="flex flex-col gap-2 mb-6">
          {orgs.map((o) => (
            <li key={o.id}>
              <Link
                href={`/${o.slug}`}
                className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 hover:bg-accent-soft transition border border-line lift"
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-full text-white font-semibold"
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
                  <div className="t-cap">{o.role}</div>
                </div>
                <span aria-hidden className="t-cap">
                  →
                </span>
              </Link>
            </li>
          ))}
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
