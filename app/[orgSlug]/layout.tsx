import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { listUserOrgs } from "@/lib/orgs";
import { HeaderWithTab } from "@/components/shell/HeaderWithTab";
import { FloatingAI } from "@/components/ui/FloatingAI";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createClient();
  const orgs = await listUserOrgs(supabase);

  const matched = orgs.find((o) => o.slug === orgSlug);
  if (!matched) notFound();

  return (
    <>
      <HeaderWithTab orgSlug={orgSlug} orgs={orgs} />
      <main className="px-6 py-6 md:px-7 md:py-7 max-w-[1400px] mx-auto">
        {children}
      </main>
      <FloatingAI />
    </>
  );
}
