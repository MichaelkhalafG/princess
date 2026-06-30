import { unstable_cache } from "next/cache";

import type { Tables } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import type { ProductFilters } from "./schema";

export type Product = Tables<"products">;
export type ProductVariant = Tables<"product_variants">;
/** A seller's own product with its variants embedded (for the dashboard editor). */
export type SellerProduct = Product & { product_variants: ProductVariant[] };

/** Review shape (forward-compat — reviews land in Phase 5; reads return []). */
export interface ProductReview {
  id: string;
  rating: number;
  comment: string | null;
}

export interface ProductListResult {
  items: Product[];
  total: number;
  page: number;
}

export interface ProductDetail {
  product: Product;
  variants: ProductVariant[];
  reviews: ProductReview[];
}

/**
 * Public product list — active products only (RLS + explicit filter), index-backed
 * filters/sort, server-side pagination (D2). Cached + tagged `products` (D5);
 * seller writes (Task 1.7) bust it via `revalidateTag('products')`. Cookie-less
 * public client → safe inside `unstable_cache`.
 */
const fetchProducts = unstable_cache(
  async (filters: ProductFilters): Promise<ProductListResult> => {
    const supabase = createPublicClient();
    const offset = (filters.page - 1) * filters.limit;

    let query = supabase
      .from("products")
      .select("*", { count: "exact" })
      .eq("status", "active");

    if (filters.category) query = query.eq("category_id", filters.category);
    if (filters.minPrice !== undefined) query = query.gte("price", filters.minPrice);
    if (filters.maxPrice !== undefined) query = query.lte("price", filters.maxPrice);

    switch (filters.sort) {
      case "price_asc":
        query = query.order("price", { ascending: true });
        break;
      case "price_desc":
        query = query.order("price", { ascending: false });
        break;
      case "top_rated":
        query = query.order("avg_rating", { ascending: false });
        break;
      default:
        query = query.order("created_at", { ascending: false }); // newest
    }

    const { data, count } = await query.range(offset, offset + filters.limit - 1);
    return { items: data ?? [], total: count ?? 0, page: filters.page };
  },
  ["products-list"],
  { tags: ["products"] },
);

export function listProducts(filters: ProductFilters): Promise<ProductListResult> {
  return fetchProducts(filters);
}

/**
 * Public product detail — active product + its variants (+ reviews placeholder).
 * Per-id cache tag `product:{id}` (D5) so a single product's edits revalidate
 * precisely; also tagged `products`. Returns null when missing or not active (→ 404).
 */
/**
 * The current seller's OWN products (all statuses incl. draft). Session-scoped via
 * the cookie server client — RLS owner policy returns only their rows. NOT cached
 * (per-user, request-scoped). For the seller dashboard ProductManager.
 */
export async function getMyProducts(): Promise<SellerProduct[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("products")
    .select("*, product_variants(*)")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });
  return (data ?? []) as SellerProduct[];
}

export function getProductById(id: string): Promise<ProductDetail | null> {
  return unstable_cache(
    async (): Promise<ProductDetail | null> => {
      const supabase = createPublicClient();
      const { data: product } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .eq("status", "active")
        .maybeSingle();
      if (!product) return null;

      const { data: variants } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", id);

      return { product, variants: variants ?? [], reviews: [] };
    },
    ["product-detail", id],
    { tags: ["products", `product:${id}`] },
  )();
}
