import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/lib/database.types";

/**
 * Server Supabase client for RSC and Route Handlers (SYSTEM_ARCHITECTURE §6/§7).
 *
 * Cookie-based — carries the authenticated USER session via the ANON key, so all
 * access is RLS-scoped to that user (CLAUDE_RULES §5). Not for privileged ops:
 * admin/service-role work goes through lib/supabase/admin.ts.
 *
 * Next 14: `cookies()` is synchronous and returns a read-only store inside Server
 * Components — the `setAll` try/catch absorbs that case (the middleware refreshes
 * the session token), while Route Handlers / Server Actions can write cookies.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase public env vars: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  const cookieStore = cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component where cookies are read-only.
          // Safe to ignore — session refresh is handled by the middleware.
        }
      },
    },
  });
}
