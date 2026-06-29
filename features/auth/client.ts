import type { ApiError, ApiEnvelope } from "@/lib/api";

/**
 * Client-side helpers for the auth forms. `import type` keeps the server-only
 * `lib/api` runtime (next/server) out of the browser bundle.
 */

export type FetchResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/** POST/GET JSON and unwrap the `{ data } | { error }` envelope into a discriminated result. */
export async function postJson<T>(
  url: string,
  body?: unknown,
  method: "POST" | "GET" = "POST",
): Promise<FetchResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const json = (await response.json()) as ApiEnvelope<T>;

    if (!response.ok || "error" in json) {
      const error =
        "error" in json
          ? json.error
          : { code: "INTERNAL" as const, message: "Unexpected error" };
      return { ok: false, error };
    }

    return { ok: true, data: json.data };
  } catch {
    return { ok: false, error: { code: "INTERNAL", message: "Network error" } };
  }
}

const KNOWN_ERROR_CODES = new Set([
  "VALIDATION",
  "EMAIL_TAKEN",
  "INVALID_CREDENTIALS",
  "UNAUTHENTICATED",
  "INTERNAL",
]);

/** Localize an API error by its stable `code`, falling back to a generic message. */
export function localizeApiError(t: (key: string) => string, error: ApiError): string {
  return KNOWN_ERROR_CODES.has(error.code) ? t(error.code) : t("generic");
}
