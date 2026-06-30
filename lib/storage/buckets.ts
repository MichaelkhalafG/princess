/**
 * Supabase Storage bucket names — single source (DATABASE.md §7, C3: replaces
 * Cloudinary). Shared by the upload route and feature code so a bucket name is
 * never a magic string.
 */
export const STORAGE_BUCKETS = {
  avatars: "avatars",
  products: "products",
  services: "services",
  portfolio: "portfolio",
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

/** Narrow an untrusted value (e.g. a form field) to an allowed bucket name. */
export function isStorageBucket(value: unknown): value is StorageBucket {
  return typeof value === "string" && Object.values(STORAGE_BUCKETS).includes(value as StorageBucket);
}

/**
 * Build an object path INSIDE a bucket. The FIRST path segment is always the
 * owner's uid — that is the Storage-RLS ownership gate
 * (`(storage.foldername(name))[1] = auth.uid()`). `scope` (e.g. a productId or a
 * random group id) is optional. The filename is sanitized to a safe charset.
 */
export function buildObjectPath(userId: string, filename: string, scope?: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+/, "");
  const segments = scope ? [userId, scope, safe] : [userId, safe];
  return segments.join("/");
}
