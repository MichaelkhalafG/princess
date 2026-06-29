import type { NextRequest } from "next/server";

import { apiError, apiSuccess, ERROR_CODES } from "@/lib/api";
import { registerUser } from "@/features/auth/mutations";
import { buildRegisterSchema, rawKey } from "@/features/auth/schema";

// POST /api/auth/register (API_MAP Auth) — Public.
// Body: { email, password, full_name, role }. role ∈ {customer,seller,provider}.
export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);

  const parsed = buildRegisterSchema(rawKey).safeParse(body);
  if (!parsed.success) {
    return apiError(ERROR_CODES.VALIDATION, "Invalid registration data", 400, parsed.error.flatten());
  }

  const result = await registerUser(parsed.data);
  if (!result.ok) {
    return apiError(result.code, result.message, result.status);
  }

  return apiSuccess({ user: result.user, session: result.session }, 201);
}
