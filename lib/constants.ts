/**
 * App-wide constants (CLAUDE_RULES §2 — one source of truth).
 */

/**
 * Product image limits — the SINGLE source for both the server upload route
 * (`/api/upload`) and the client `ImageUploader`. Bump `maxCount` to 8 here (and
 * only here) for premium/dress listings later; never re-hardcode the numbers/mime.
 */
export const PRODUCT_IMAGE_LIMITS = {
  maxCount: 6,
  maxSizeBytes: 5 * 1024 * 1024, // 5 MB
  allowedMime: ["image/jpeg", "image/png", "image/webp"],
} as const;

export type AllowedImageMime = (typeof PRODUCT_IMAGE_LIMITS.allowedMime)[number];

/** Convenience: the size limit in whole MB (for messages). */
export const PRODUCT_IMAGE_MAX_MB = PRODUCT_IMAGE_LIMITS.maxSizeBytes / (1024 * 1024);
