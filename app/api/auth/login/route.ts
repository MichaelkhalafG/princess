import type { NextRequest } from "next/server";

import { apiError, apiSuccess, ERROR_CODES } from "@/lib/api";
import { signIn } from "@/features/auth/mutations";
import { buildLoginSchema, rawKey } from "@/features/auth/schema";

// POST /api/auth/login (API_MAP Auth) — Public.
// Body: { email, password }.
export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);

  const parsed = buildLoginSchema(rawKey).safeParse(body);
  if (!parsed.success) {
    return apiError(ERROR_CODES.VALIDATION, "Invalid login data", 400, parsed.error.flatten());
  }

  const result = await signIn(parsed.data);
  if (!result.ok) {
    return apiError(result.code, result.message, result.status);
  }

  return apiSuccess({ user: result.user, session: result.session });
}
