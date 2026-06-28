import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

/**
 * Service-role Supabase client — BYPASSES RLS (CLAUDE_RULES §5, REQ-NFR-05).
 *
 * ⛔ NEVER import this from a client component or any browser-reachable module.
 * The `import "server-only"` above makes the build FAIL if this file is pulled
 * into a client bundle. Use ONLY in server-side privileged operations:
 * payment webhooks, COD confirmation, settlements, admin approvals/verification.
 *
 * The browser uses lib/supabase/client.ts (anon + RLS); RSC/handlers carrying a
 * user session use lib/supabase/server.ts.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase admin env vars: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
