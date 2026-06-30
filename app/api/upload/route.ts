import type { NextRequest } from "next/server";

import { apiError, apiSuccess, ERROR_CODES } from "@/lib/api";
import { PRODUCT_IMAGE_LIMITS } from "@/lib/constants";
import { buildObjectPath, isStorageBucket } from "@/lib/storage/buckets";
import { createClient } from "@/lib/supabase/server";

// POST /api/upload (API_MAP Uploads/Storage; DATABASE.md §7; Decision D3).
// User-authenticated; uploads via the cookie SERVER client so Storage RLS enforces
// per-owner write (path = {uid}/…). NO service-role here (CLAUDE_RULES §5). No Cloudinary (C3).
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiError(ERROR_CODES.UNAUTHENTICATED, "Not authenticated", 401);
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return apiError(ERROR_CODES.VALIDATION, "Expected multipart/form-data", 400);
  }

  const bucket = form.get("bucket");
  if (!isStorageBucket(bucket)) {
    return apiError(ERROR_CODES.VALIDATION, "Unknown or missing bucket", 400);
  }

  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (files.length === 0) {
    return apiError(ERROR_CODES.BAD_FILE, "No files provided", 400);
  }
  if (files.length > PRODUCT_IMAGE_LIMITS.maxCount) {
    return apiError(
      ERROR_CODES.VALIDATION,
      `At most ${PRODUCT_IMAGE_LIMITS.maxCount} files allowed`,
      400,
    );
  }

  const allowedMime: readonly string[] = PRODUCT_IMAGE_LIMITS.allowedMime;
  for (const file of files) {
    if (!allowedMime.includes(file.type)) {
      return apiError(ERROR_CODES.BAD_FILE, `Unsupported file type: ${file.type || "unknown"}`, 400);
    }
    if (file.size > PRODUCT_IMAGE_LIMITS.maxSizeBytes) {
      return apiError(ERROR_CODES.TOO_LARGE, `${file.name} exceeds the size limit`, 413);
    }
  }

  const items: { url: string; path: string }[] = [];
  for (const file of files) {
    // First path segment = uid (the RLS ownership gate); per-file uuid avoids collisions.
    const path = buildObjectPath(user.id, `${crypto.randomUUID()}-${file.name}`);
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      // Storage RLS denial or other upload failure — surface safely (no secrets).
      return apiError(ERROR_CODES.BAD_FILE, `Upload failed: ${error.message}`, 400);
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    items.push({ url: data.publicUrl, path });
  }

  return apiSuccess({ urls: items.map((item) => item.url), items });
}
