import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

/**
 * Browser Supabase client.
 *
 * If the NEXT_PUBLIC_SUPABASE_* env vars are missing (e.g. during a
 * static prerender on Vercel before the user has configured them),
 * we return a Proxy that throws only on first method access. That
 * lets the build complete; the runtime will surface a clear error
 * the moment any auth/query is attempted.
 */
export function createClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return new Proxy({} as SupabaseClient<Database>, {
      get(_t, prop) {
        throw new Error(
          `[NEO PM] Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel (Project → Settings → Environment Variables). Accessed: "${String(prop)}".`,
        );
      },
    });
  }

  return createBrowserClient<Database>(url, key);
}
