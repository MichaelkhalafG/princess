import { apiError, apiSuccess, ERROR_CODES } from "@/lib/api";
import { signOut } from "@/features/auth/mutations";
import { createClient } from "@/lib/supabase/server";

// POST /api/auth/logout (API_MAP Auth) — User. Clears the session cookie.
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError(ERROR_CODES.UNAUTHENTICATED, "Not authenticated", 401);
  }

  const result = await signOut();
  if (!result.ok) {
    return apiError(result.code, result.message, result.status);
  }

  return apiSuccess({ ok: true });
}
