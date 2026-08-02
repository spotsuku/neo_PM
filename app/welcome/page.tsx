import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "@/components/login/SetPasswordForm";
import { getDisplayName } from "@/lib/userDisplay";

// Requires runtime Supabase client.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "ようこそ — AI PM",
};

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 表示名は profiles.display_name (community 同期済みの氏名) を優先する。
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = getDisplayName(profile, user, "ようこそ");

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <SetPasswordForm
        displayName={displayName}
        nextPath={next ?? "/orgs"}
      />
    </main>
  );
}
