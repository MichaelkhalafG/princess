import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";

/**
 * Browser Supabase client (CLAUDE_RULES §5, SYSTEM_ARCHITECTURE §6/§7).
 *
 * Uses the ANON key only — all access is governed by RLS. The service-role key
 * is NEVER used here; see lib/supabase/admin.ts for privileged server ops.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase public env vars: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return createBrowserClient<Database>(url, anonKey);
}
