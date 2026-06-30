import "server-only";

import { revalidateTag } from "next/cache";

import { ERROR_CODES, type ErrorCode } from "@/lib/api";
import type { Json, TablesInsert } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import type { ProductInput } from "./schema";

/**
 * Seller product mutations (REQ-PROD-04/05; CLAUDE_RULES §5 — RLS-first). All writes
 * go through the cookie SERVER client so RLS scopes them to the owner; `seller_id`
 * is taken from the session (NEVER the body), and update/delete additionally do a
 * server-side ownership re-check for a clean 403. Each write busts the catalog cache
 * (D5). Returns a discriminated result (routes map it to the envelope).
 */
export type MutationResult =
  | { ok: true; id: string }
  | { ok: false; code: ErrorCode; message: string; status: number };

const fail = (code: ErrorCode, message: string, status: number): MutationResult => ({
  ok: false,
  code,
  message,
  status,
});

function toProductRow(input: ProductInput, sellerId: string): TablesInsert<"products"> {
  return {
    seller_id: sellerId,
    title: input.title,
    description: input.description ?? null,
    category_id: input.category_id ?? null,
    price: input.price,
    currency: input.currency,
    is_rentable: input.is_rentable,
    rental_daily_price: input.is_rentable ? (input.rental_daily_price ?? null) : null,
    security_deposit: input.is_rentable ? (input.security_deposit ?? null) : null,
    // {url,alt,sort}[] persisted to the jsonb column.
    images: input.images as unknown as Json,
    stock: input.stock,
    status: input.status,
  };
}

function toVariantRows(input: ProductInput, productId: string): TablesInsert<"product_variants">[] {
  return input.variants.map((variant) => ({
    product_id: productId,
    size: variant.size?.trim() ? variant.size.trim() : null,
    color: variant.color?.trim() ? variant.color.trim() : null,
    stock: variant.stock,
    sku: variant.sku?.trim() ? variant.sku.trim() : null,
  }));
}

export async function createProduct(input: ProductInput): Promise<MutationResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(ERROR_CODES.UNAUTHENTICATED, "Not authenticated", 401);

  const { data: product, error } = await supabase
    .from("products")
    .insert(toProductRow(input, user.id))
    .select("id")
    .single();
  if (error || !product) {
    return fail(ERROR_CODES.VALIDATION, error?.message ?? "Could not create product", 400);
  }

  if (input.variants.length > 0) {
    const { error: variantError } = await supabase
      .from("product_variants")
      .insert(toVariantRows(input, product.id));
    if (variantError) return fail(ERROR_CODES.VALIDATION, variantError.message, 400);
  }

  revalidateTag("products");
  return { ok: true, id: product.id };
}

export async function updateProduct(id: string, input: ProductInput): Promise<MutationResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(ERROR_CODES.UNAUTHENTICATED, "Not authenticated", 401);

  // Ownership re-check (in addition to RLS) → clean 404/403.
  const { data: existing } = await supabase
    .from("products")
    .select("seller_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return fail(ERROR_CODES.NOT_FOUND, "Product not found", 404);
  if (existing.seller_id !== user.id) return fail(ERROR_CODES.FORBIDDEN, "Not your product", 403);

  const { error } = await supabase.from("products").update(toProductRow(input, user.id)).eq("id", id);
  if (error) return fail(ERROR_CODES.VALIDATION, error.message, 400);

  // Full replace of variants (the form submits the complete set).
  await supabase.from("product_variants").delete().eq("product_id", id);
  if (input.variants.length > 0) {
    const { error: variantError } = await supabase
      .from("product_variants")
      .insert(toVariantRows(input, id));
    if (variantError) return fail(ERROR_CODES.VALIDATION, variantError.message, 400);
  }

  revalidateTag("products");
  revalidateTag(`product:${id}`);
  return { ok: true, id };
}

export async function deleteProduct(id: string): Promise<MutationResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(ERROR_CODES.UNAUTHENTICATED, "Not authenticated", 401);

  const { data: existing } = await supabase
    .from("products")
    .select("seller_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return fail(ERROR_CODES.NOT_FOUND, "Product not found", 404);
  if (existing.seller_id !== user.id) return fail(ERROR_CODES.FORBIDDEN, "Not your product", 403);

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return fail(ERROR_CODES.VALIDATION, error.message, 400);

  revalidateTag("products");
  revalidateTag(`product:${id}`);
  return { ok: true, id };
}
