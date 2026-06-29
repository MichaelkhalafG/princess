import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";

export type Profile = Tables<"profiles">;

/**
 * The current session user's profile, or `null` if unauthenticated.
 *
 * Reads through the cookie-bound anon client, so RLS scopes the row to the
 * caller (CLAUDE_RULES §5). This is the single source backing both
 * `GET /api/auth/me` and the dashboard pages — never trust a client-side claim.
 */
export async function getSessionProfile(): Promise<Profile | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  return profile ?? null;
}
