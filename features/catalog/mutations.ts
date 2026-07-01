import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidateTag } from "next/cache";

import { ERROR_CODES, type ErrorCode } from "@/lib/api";
import type { Database, Json, TablesInsert } from "@/lib/database.types";
import { CURRENCY_BY_MARKET, type Market } from "@/lib/markets";
import { createClient } from "@/lib/supabase/server";
import type { ProductInput } from "./schema";

type Db = SupabaseClient<Database>;

/**
 * Seller product mutations (REQ-PROD-04/05/07/08; CLAUDE_RULES §5 — RLS-first). All
 * writes go through the cookie SERVER client so RLS scopes them to the owner; `seller_id`
 * comes from the session (NEVER the body). Money/stock are PER-MARKET (CR-01 §B): a
 * seller may only price a market they're APPROVED for (`vendor_markets.is_approved`) —
 * enforced by RLS + this app guard. Each write busts the catalog cache (D5).
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

/** Market-agnostic product columns only — money/stock live in product_prices now. */
function toProductRow(input: ProductInput, sellerId: string): TablesInsert<"products"> {
  return {
    seller_id: sellerId,
    title: input.title,
    description: input.description ?? null,
    category_id: input.category_id ?? null,
    is_rentable: input.is_rentable,
    images: input.images as unknown as Json, // {url,alt,sort}[] persisted to jsonb
    status: input.status,
  };
}

/** The markets a seller has an APPROVED local presence for (the only ones they may price). */
async function approvedMarkets(supabase: Db, sellerId: string): Promise<Set<Market>> {
  const { data } = await supabase
    .from("vendor_markets")
    .select("market")
    .eq("vendor_id", sellerId)
    .eq("is_approved", true);
  return new Set((data ?? []).map((row) => row.market));
}

/** Full-replace the product's per-market prices (only approved markets; currency derived). */
async function replacePrices(
  supabase: Db,
  productId: string,
  input: ProductInput,
  approved: Set<Market>,
): Promise<string | null> {
  await supabase.from("product_prices").delete().eq("product_id", productId);

  const rows: TablesInsert<"product_prices">[] = input.prices
    .filter((price) => approved.has(price.market))
    .map((price) => ({
      product_id: productId,
      market: price.market,
      currency: CURRENCY_BY_MARKET[price.market],
      price: price.price,
      rental_daily_price: input.is_rentable ? (price.rental_daily_price ?? null) : null,
      security_deposit: input.is_rentable ? (price.security_deposit ?? null) : null,
      stock: price.stock,
      is_available: price.is_available,
    }));
  if (rows.length === 0) return "At least one price for an approved market is required.";

  const { error } = await supabase.from("product_prices").insert(rows);
  return error ? error.message : null;
}

/** Full-replace variants (identity) + their per-market stock. Client-side ids link stock. */
async function replaceVariants(
  supabase: Db,
  productId: string,
  input: ProductInput,
  approved: Set<Market>,
): Promise<string | null> {
  await supabase.from("product_variants").delete().eq("product_id", productId); // cascades stock
  if (input.variants.length === 0) return null;

  const variantRows: TablesInsert<"product_variants">[] = [];
  const stockRows: TablesInsert<"product_variant_stock">[] = [];
  for (const variant of input.variants) {
    const id = variant.id ?? randomUUID();
    variantRows.push({
      id,
      product_id: productId,
      size: variant.size?.trim() ? variant.size.trim() : null,
      color: variant.color?.trim() ? variant.color.trim() : null,
      sku: variant.sku?.trim() ? variant.sku.trim() : null,
    });
    for (const entry of variant.stock) {
      if (approved.has(entry.market)) {
        stockRows.push({ variant_id: id, market: entry.market, stock: entry.stock });
      }
    }
  }

  const { error: variantError } = await supabase.from("product_variants").insert(variantRows);
  if (variantError) return variantError.message;
  if (stockRows.length > 0) {
    const { error: stockError } = await supabase.from("product_variant_stock").insert(stockRows);
    if (stockError) return stockError.message;
  }
  return null;
}

/**
 * Full-replace the product's controlled color/size facet values (CR-01 §G). The form
 * submits the complete set of option ids; we resolve each option's attribute_id and
 * rewrite `product_attributes`. Returns an error message or null. NO free text.
 */
async function replaceProductAttributes(
  supabase: Db,
  productId: string,
  optionIds: string[],
): Promise<string | null> {
  await supabase.from("product_attributes").delete().eq("product_id", productId);
  if (optionIds.length === 0) return null;

  const { data: options } = await supabase
    .from("attribute_options")
    .select("id, attribute_id")
    .in("id", optionIds);
  const rows: TablesInsert<"product_attributes">[] = (options ?? []).map((option) => ({
    product_id: productId,
    attribute_id: option.attribute_id,
    option_id: option.id,
  }));
  if (rows.length === 0) return null;

  const { error } = await supabase.from("product_attributes").insert(rows);
  return error ? error.message : null;
}

/** Reject any submitted price for a market the seller isn't approved for (clean 403). */
function unapprovedMarket(input: ProductInput, approved: Set<Market>): Market | null {
  return input.prices.find((price) => !approved.has(price.market))?.market ?? null;
}

export async function createProduct(input: ProductInput): Promise<MutationResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(ERROR_CODES.UNAUTHENTICATED, "Not authenticated", 401);

  const approved = await approvedMarkets(supabase, user.id);
  const blocked = unapprovedMarket(input, approved);
  if (blocked) return fail(ERROR_CODES.FORBIDDEN, `Not approved to sell in market ${blocked}`, 403);

  const { data: product, error } = await supabase
    .from("products")
    .insert(toProductRow(input, user.id))
    .select("id")
    .single();
  if (error || !product) {
    return fail(ERROR_CODES.VALIDATION, error?.message ?? "Could not create product", 400);
  }

  const priceError = await replacePrices(supabase, product.id, input, approved);
  if (priceError) return fail(ERROR_CODES.VALIDATION, priceError, 400);
  const variantError = await replaceVariants(supabase, product.id, input, approved);
  if (variantError) return fail(ERROR_CODES.VALIDATION, variantError, 400);
  const attributeError = await replaceProductAttributes(supabase, product.id, input.attribute_option_ids);
  if (attributeError) return fail(ERROR_CODES.VALIDATION, attributeError, 400);

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

  const approved = await approvedMarkets(supabase, user.id);
  const blocked = unapprovedMarket(input, approved);
  if (blocked) return fail(ERROR_CODES.FORBIDDEN, `Not approved to sell in market ${blocked}`, 403);

  const { error } = await supabase.from("products").update(toProductRow(input, user.id)).eq("id", id);
  if (error) return fail(ERROR_CODES.VALIDATION, error.message, 400);

  const priceError = await replacePrices(supabase, id, input, approved);
  if (priceError) return fail(ERROR_CODES.VALIDATION, priceError, 400);
  const variantError = await replaceVariants(supabase, id, input, approved);
  if (variantError) return fail(ERROR_CODES.VALIDATION, variantError, 400);
  const attributeError = await replaceProductAttributes(supabase, id, input.attribute_option_ids);
  if (attributeError) return fail(ERROR_CODES.VALIDATION, attributeError, 400);

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
