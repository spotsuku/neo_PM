import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "@/components/login/SetPasswordForm";

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

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    (user.email ? user.email.split("@")[0] : "ようこそ");

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <SetPasswordForm
        displayName={displayName}
        nextPath={next ?? "/orgs"}
      />
    </main>
  );
}
