import type { NextRequest } from "next/server";

import { apiError, apiSuccess, ERROR_CODES } from "@/lib/api";
import { getSessionProfile } from "@/features/auth/queries";
import { createProduct } from "@/features/catalog/mutations";
import { listProducts } from "@/features/catalog/queries";
import { productFiltersSchema, productSchema } from "@/features/catalog/schema";
import { resolveReadMarket } from "@/lib/markets-server";

// GET /api/products?category=&minPrice=&maxPrice=&rentable=&sort=&page=&limit= (API_MAP
// Products). Public; MARKET is server-resolved (cookie/profile) — `?market=` is honored
// only for an admin (resolveReadMarket). Returns { data: { items, total, page } } for the
// active market. 400 VALIDATION on bad filters.
export async function GET(request: NextRequest) {
  const raw = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = productFiltersSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError(ERROR_CODES.VALIDATION, "Invalid product filters", 400, parsed.error.flatten());
  }

  const market = await resolveReadMarket(request.nextUrl.searchParams.get("market"));
  const result = await listProducts(parsed.data, market);
  return apiSuccess(result);
}

// POST /api/products — APPROVED sellers only (role seller AND status active —
// pending sellers cannot list, REQ-AUTH-05). `seller_id` is set from the session.
export async function POST(request: NextRequest) {
  const profile = await getSessionProfile();
  if (!profile) return apiError(ERROR_CODES.UNAUTHENTICATED, "Not authenticated", 401);
  if (profile.role !== "seller" || profile.status !== "active") {
    return apiError(ERROR_CODES.FORBIDDEN, "Only approved sellers can create products", 403);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(ERROR_CODES.VALIDATION, "Invalid product", 400, parsed.error.flatten());
  }

  const result = await createProduct(parsed.data);
  if (!result.ok) return apiError(result.code, result.message, result.status);
  return apiSuccess({ id: result.id }, 201);
}
