import { NextResponse } from "next/server";

/**
 * Typed API response envelope (API_MAP.md "Response envelope").
 *   success → { data }
 *   error   → { error: { code, message, details? } }
 *
 * `code` is a stable machine-readable token (API_MAP "Standard Error Codes");
 * `message` is a human-readable fallback. Clients localize off `code` and only
 * fall back to `message` when no localized copy exists.
 */
export const ERROR_CODES = {
  VALIDATION: "VALIDATION",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  EMAIL_TAKEN: "EMAIL_TAKEN",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export type ApiError = {
  code: ErrorCode;
  message: string;
  details?: unknown;
};

export type ApiEnvelope<T> = { data: T } | { error: ApiError };

/** Success envelope. `status` defaults to 200 (use 201 for creates). */
export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json<ApiEnvelope<T>>({ data }, { status });
}

/** Error envelope with a stable code + HTTP status. */
export function apiError(
  code: ErrorCode,
  message: string,
  status: number,
  details?: unknown,
): NextResponse {
  return NextResponse.json<ApiEnvelope<never>>({ error: { code, message, details } }, { status });
}
