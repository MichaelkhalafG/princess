import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";

import { apiError, apiSuccess, ERROR_CODES } from "@/lib/api";
import type { TablesInsert } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAttributes } from "@/features/catalog/queries";
import { getSessionProfile } from "@/features/auth/queries";
import { attributesPutSchema } from "@/features/catalog/schema";

// API_MAP "Admin /api/admin/attributes" (CR-01 §G, REQ-DASH-05). Admin-gated server-side
// (role read from the DB profile — never a client claim). Manages the controlled facet
// vocabulary; writes are service-role only (same RLS posture as categories). Typed envelope.

/** GET — the full attribute vocabulary (definitions + options). */
export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) return apiError(ERROR_CODES.UNAUTHENTICATED, "Not authenticated", 401);
  if (profile.role !== "admin") return apiError(ERROR_CODES.FORBIDDEN, "Admins only", 403);

  const attributes = await getAttributes();
  return apiSuccess({ attributes });
}

/** PUT — batch upsert of definitions and/or options; busts the `attributes` cache tag (D5). */
export async function PUT(request: NextRequest) {
  const profile = await getSessionProfile();
  if (!profile) return apiError(ERROR_CODES.UNAUTHENTICATED, "Not authenticated", 401);
  if (profile.role !== "admin") return apiError(ERROR_CODES.FORBIDDEN, "Admins only", 403);

  const body: unknown = await request.json().catch(() => null);
  const parsed = attributesPutSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(ERROR_CODES.VALIDATION, "Invalid attributes payload", 400, parsed.error.flatten());
  }

  const admin = createAdminClient();

  if (parsed.data.definitions.length > 0) {
    const rows: TablesInsert<"attribute_definitions">[] = parsed.data.definitions.map((definition) => ({
      ...definition,
      sort_order: definition.sort_order ?? 0,
    }));
    const { error } = await admin.from("attribute_definitions").upsert(rows, { onConflict: "id" });
    if (error) return apiError(ERROR_CODES.VALIDATION, error.message, 400);
  }

  if (parsed.data.options.length > 0) {
    const rows: TablesInsert<"attribute_options">[] = parsed.data.options.map((option) => ({
      ...option,
      sort_order: option.sort_order ?? 0,
    }));
    const { error } = await admin.from("attribute_options").upsert(rows, { onConflict: "id" });
    if (error) return apiError(ERROR_CODES.VALIDATION, error.message, 400);
  }

  revalidateTag("attributes");
  const attributes = await getAttributes();
  return apiSuccess({ attributes });
}
