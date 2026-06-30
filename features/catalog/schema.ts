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
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  sort: z.enum(PRODUCT_SORTS).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(20),
});

export type ProductFilters = z.infer<typeof productFiltersSchema>;

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

export const productVariantInputSchema = z.object({
  id: z.string().uuid().optional(),
  size: z.string().trim().optional(),
  color: z.string().trim().optional(),
  stock: z.number().int().min(0).default(0),
  sku: z.string().trim().optional(),
});

export const productSchema = z
  .object({
    title: z.string().trim().min(2).max(140),
    description: z.string().trim().max(4000).optional(),
    category_id: z.string().uuid().nullable().optional(),
    price: z.number().min(0),
    currency: z.enum(["SAR", "EGP"]),
    is_rentable: z.boolean().default(false),
    rental_daily_price: z.number().min(0).optional(),
    security_deposit: z.number().min(0).optional(),
    images: z.array(productImageSchema).max(PRODUCT_IMAGE_LIMITS.maxCount).default([]),
    stock: z.number().int().min(0).default(0),
    status: z.enum(["draft", "active", "inactive"]),
    variants: z.array(productVariantInputSchema).default([]),
  })
  .refine((value) => !value.is_rentable || value.rental_daily_price !== undefined, {
    message: "Rental daily price is required for rentable products",
    path: ["rental_daily_price"],
  });

export type ProductInput = z.infer<typeof productSchema>;
