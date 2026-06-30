import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";

import { apiError, apiSuccess, ERROR_CODES } from "@/lib/api";
import type { TablesInsert } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCategories } from "@/features/catalog/categories";
import { getSessionProfile } from "@/features/auth/queries";
import { categoriesPutSchema } from "@/features/catalog/schema";

// API_MAP "Admin /api/admin/categories". Admin-gated server-side (never trust a
// client claim — role read from the DB profile). Typed envelope.

/** GET — all categories (admin manages every kind). */
export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) return apiError(ERROR_CODES.UNAUTHENTICATED, "Not authenticated", 401);
  if (profile.role !== "admin") return apiError(ERROR_CODES.FORBIDDEN, "Admins only", 403);

  const categories = await getCategories();
  return apiSuccess({ categories });
}

/** PUT — batch upsert/reorder. Writes via the service-role client (categories writes
 *  are service-role-only per RLS), then busts the `categories` cache tag (D5). */
export async function PUT(request: NextRequest) {
  const profile = await getSessionProfile();
  if (!profile) return apiError(ERROR_CODES.UNAUTHENTICATED, "Not authenticated", 401);
  if (profile.role !== "admin") return apiError(ERROR_CODES.FORBIDDEN, "Admins only", 403);

  const body: unknown = await request.json().catch(() => null);
  const parsed = categoriesPutSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(ERROR_CODES.VALIDATION, "Invalid categories payload", 400, parsed.error.flatten());
  }

  const rows: TablesInsert<"categories">[] = parsed.data.categories.map((category) => ({
    ...category,
    sort_order: category.sort_order ?? 0,
  }));

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("categories")
    .upsert(rows, { onConflict: "id" })
    .select();

  if (error) {
    // e.g. duplicate slug (unique violation) — surface as validation, no secrets.
    return apiError(ERROR_CODES.VALIDATION, error.message, 400);
  }

  revalidateTag("categories");
  return apiSuccess({ categories: data });
}
