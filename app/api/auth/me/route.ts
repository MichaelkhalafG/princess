import { apiError, apiSuccess, ERROR_CODES } from "@/lib/api";
import { getSessionProfile } from "@/features/auth/queries";

// GET /api/auth/me (API_MAP Auth) — User. Returns the session user's profile.
export async function GET() {
  const profile = await getSessionProfile();

  if (!profile) {
    return apiError(ERROR_CODES.UNAUTHENTICATED, "Not authenticated", 401);
  }

  return apiSuccess({ profile });
}
