import { revalidateTag } from "next/cache";

import { apiError, apiSuccess, ERROR_CODES } from "@/lib/api";

/**
 * DEV-ONLY cache buster. The catalog reads are cached via `unstable_cache` with the
 * `products` / `categories` tags (Decision D5); the dummy seed (scripts/seed-dummy.ts)
 * writes straight to the DB, so it never fires `revalidateTag` and the Data Cache can
 * serve a stale (e.g. pre-seed empty) result. Hit this after seeding to bust those
 * tags without clearing `.next/cache` or restarting.
 *
 * Returns 404 in production — there is no production use for this.
 */
const TAGS = ["products", "categories"] as const;

function handle() {
  if (process.env.NODE_ENV === "production") {
    return apiError(ERROR_CODES.NOT_FOUND, "Not available in production", 404);
  }
  for (const tag of TAGS) revalidateTag(tag);
  return apiSuccess({ revalidated: [...TAGS] });
}

export function GET() {
  return handle();
}

export function POST() {
  return handle();
}
