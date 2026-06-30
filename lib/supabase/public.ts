import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

/**
 * Cookie-less anon Supabase client for CACHED PUBLIC reads (catalog) — RLS-scoped
 * to `anon`, so it only sees public (`active`/published) rows. Because it never
 * touches `cookies()`, it is safe inside `unstable_cache` (where request-scoped
 * APIs throw). For session-scoped reads use lib/supabase/server.ts; for privileged
 * writes use lib/supabase/admin.ts.
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase public env vars: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return createSupabaseClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
