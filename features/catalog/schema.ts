import { z } from "zod";

import { PRODUCT_IMAGE_LIMITS } from "@/lib/constants";
import type { SortOption } from "@/lib/hooks/use-filters";

/**
 * Catalog validation schemas (CLAUDE_RULES §5 — server-side Zod; §2 — one source).
 * Categories + product browse filters now; product write schema is added in 1.7.
 */

/** One category upsert (create when `id` omitted; update/rename/reparent/sort when present). */
export const categoryUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  kind: z.enum(["product", "service"]),
  name_ar: z.string().trim().min(1),
  name_en: z.string().trim().min(1),
  slug: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase, hyphen-separated slug"),
  sort_order: z.number().int().min(0).optional(),
});

export type CategoryUpsert = z.infer<typeof categoryUpsertSchema>;

/** `PUT /api/admin/categories` body — a batch upsert/reorder. */
export const categoriesPutSchema = z.object({
  categories: z.array(categoryUpsertSchema).min(1),
});

// Sort values — kept in lockstep with the client `SortOption` via `satisfies`
// (type-only import, no runtime coupling to the client hook).
const PRODUCT_SORTS = ["newest", "price_asc", "price_desc", "top_rated"] as const satisfies readonly SortOption[];

/** Public catalog browse filters (API_MAP `GET /api/products`; Decisions D1/D2). */
export const productFiltersSchema = z.object({
  category: z.string().uuid().optional(), // category_id (Phase 1 uses id, not slug — see queries.ts)
  // Single max-price ceiling (Direction A slider). `minPrice` was dropped in the restyle.
  maxPrice: z.coerce.number().int().min(0).optional(),
  // Rentable toggle (CR-01 §B) — filters on products.is_rentable. Presence-based flag
  // (`?rentable=1`); any non-truthy value is treated as "no filter".
  rentable: z.preprocess((v) => (v === "1" || v === "true" ? true : undefined), z.boolean().optional()),
  sort: z.enum(PRODUCT_SORTS).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(20),
});

export type ProductFilters = z.infer<typeof productFiltersSchema>;

/**
 * Parse attribute facets from server searchParams into `{ attributeSlug: [optionSlug] }`
 * (CR-01 §G). Contract: `?attr_<attributeSlug>=<optionSlug>,<optionSlug>` (multi-valued,
 * OR within an attribute). Kept in lockstep with the `attr_` prefix in `useFilters`.
 */
export function parseFacets(
  searchParams: Record<string, string | string[] | undefined>,
): Record<string, string[]> {
  const facets: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    if (!key.startsWith("attr_") || typeof value !== "string") continue;
    const options = value
      .split(",")
      .map((slug) => slug.trim())
      .filter(Boolean);
    if (options.length > 0) facets[key.slice("attr_".length)] = options;
  }
  return facets;
}

// ---------------------------------------------------------------------------
// Product write schema (POST/PUT) — REQ-PROD-04/05. Number-based: the RHF form
// and the JSON API both send real numbers (no string coercion). Money in major
// units (numeric in DB). Seller-settable statuses only ('rejected' is admin-set).
// ---------------------------------------------------------------------------
export const productImageSchema = z.object({
  url: z.string().url(),
  alt: z.string().default(""),
  sort: z.number().int().min(0),
});

// Market literals (mirror the DB `market` enum / lib/markets.ts).
const MARKET_VALUES = ["EG", "SA"] as const;

/** Per-market money block (CR-01 §B). Currency is DERIVED from market — never entered. */
export const productPriceInputSchema = z.object({
  market: z.enum(MARKET_VALUES),
  price: z.number().min(0),
  rental_daily_price: z.number().min(0).optional(),
  security_deposit: z.number().min(0).optional(),
  stock: z.number().int().min(0).default(0), // base (no-variant) stock for this market
  is_available: z.boolean().default(true),
});

/** Per-market variant stock (Q-B1) — one entry per market the variant is stocked in. */
export const variantStockInputSchema = z.object({
  market: z.enum(MARKET_VALUES),
  stock: z.number().int().min(0).default(0),
});

export const productVariantInputSchema = z.object({
  id: z.string().uuid().optional(),
  size: z.string().trim().optional(),
  color: z.string().trim().optional(),
  sku: z.string().trim().optional(),
  stock: z.array(variantStockInputSchema).default([]),
});

export const productSchema = z
  .object({
    title: z.string().trim().min(2).max(140),
    description: z.string().trim().max(4000).optional(),
    category_id: z.string().uuid().nullable().optional(),
    is_rentable: z.boolean().default(false),
    images: z.array(productImageSchema).max(PRODUCT_IMAGE_LIMITS.maxCount).default([]),
    status: z.enum(["draft", "active", "inactive"]),
    // One price block per market the seller covers (approved). No auto-conversion.
    prices: z.array(productPriceInputSchema).min(1),
    variants: z.array(productVariantInputSchema).default([]),
    // Controlled color/size facet values (CR-01 §G, Q-G1). Option UUIDs only — no free
    // text; validity is backstopped by the FK to attribute_options.
    attribute_option_ids: z.array(z.string().uuid()).default([]),
  })
  .refine(
    (value) => !value.is_rentable || value.prices.every((p) => p.rental_daily_price !== undefined),
    { message: "Rental daily price is required for rentable products", path: ["prices"] },
  );

export type ProductInput = z.infer<typeof productSchema>;
export type ProductPriceInput = z.infer<typeof productPriceInputSchema>;

// ---------------------------------------------------------------------------
// Admin attribute-vocabulary management (REQ-DASH-05, CR-01 §G). Definitions +
// options are the controlled facet vocabulary; writes are service-role only.
// ---------------------------------------------------------------------------
const slugField = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase, hyphen-separated slug");

export const attributeDefinitionUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid().nullable().optional(),
  key_ar: z.string().trim().min(1),
  key_en: z.string().trim().min(1),
  slug: slugField,
  input: z.enum(["select", "multiselect"]),
  sort_order: z.number().int().min(0).optional(),
});

export const attributeOptionUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  attribute_id: z.string().uuid(),
  value_ar: z.string().trim().min(1),
  value_en: z.string().trim().min(1),
  slug: slugField,
  sort_order: z.number().int().min(0).optional(),
});

/** `PUT /api/admin/attributes` body — batch upsert of definitions and/or options. */
export const attributesPutSchema = z.object({
  definitions: z.array(attributeDefinitionUpsertSchema).default([]),
  options: z.array(attributeOptionUpsertSchema).default([]),
});
