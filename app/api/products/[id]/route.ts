import type { NextRequest } from "next/server";

import { apiError, apiSuccess, ERROR_CODES } from "@/lib/api";
import { getSessionProfile } from "@/features/auth/queries";
import { deleteProduct, updateProduct } from "@/features/catalog/mutations";
import { getProductById } from "@/features/catalog/queries";
import { productSchema } from "@/features/catalog/schema";
import { resolveReadMarket } from "@/lib/markets-server";

// GET /api/products/:id (API_MAP Products). Public; returns
// { data: { product, variants, reviews } } for the active market. 404 NOT_FOUND when
// missing/inactive OR not priced in the active market (invisible — no cross-market leak;
// the human-facing soft "not available" page is the RSC's job, DC-2).
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const market = await resolveReadMarket(request.nextUrl.searchParams.get("market"));
  const result = await getProductById(params.id, market);
  if (result.status !== "ok") {
    return apiError(ERROR_CODES.NOT_FOUND, "Product not found", 404);
  }
  return apiSuccess(result.detail);
}

/** Approved-seller gate shared by PUT/DELETE (ownership re-checked in the mutation). */
async function requireSeller() {
  const profile = await getSessionProfile();
  if (!profile) return apiError(ERROR_CODES.UNAUTHENTICATED, "Not authenticated", 401);
  if (profile.role !== "seller" || profile.status !== "active") {
    return apiError(ERROR_CODES.FORBIDDEN, "Only approved sellers can manage products", 403);
  }
  return null;
}

// PUT /api/products/:id — owner only (RLS + server re-check). Full product payload.
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireSeller();
  if (denied) return denied;

  const body: unknown = await request.json().catch(() => null);
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(ERROR_CODES.VALIDATION, "Invalid product", 400, parsed.error.flatten());
  }

  const result = await updateProduct(params.id, parsed.data);
  if (!result.ok) return apiError(result.code, result.message, result.status);
  return apiSuccess({ id: result.id });
}

// DELETE /api/products/:id — owner only (RLS + server re-check) → { ok }.
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireSeller();
  if (denied) return denied;

  const result = await deleteProduct(params.id);
  if (!result.ok) return apiError(result.code, result.message, result.status);
  return apiSuccess({ ok: true });
}
