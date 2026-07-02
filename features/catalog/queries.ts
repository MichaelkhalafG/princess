import { unstable_cache } from "next/cache";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Enums, Tables } from "@/lib/database.types";
import type { Market } from "@/lib/markets";
import type { Currency } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import type { ProductFilters } from "./schema";

type Db = SupabaseClient<Database>;

export type Product = Tables<"products">;
export type ProductVariant = Tables<"product_variants">;
export type ProductPrice = Tables<"product_prices">;
/**
 * A seller's own product with everything the editor needs: per-market prices, variants
 * (each with per-market stock), and selected facet option ids. All statuses.
 */
export type SellerProduct = Product & {
  product_prices: ProductPrice[];
  product_variants: (ProductVariant & { product_variant_stock: { market: Market; stock: number }[] })[];
  product_attributes: { option_id: string }[];
};

/** Public seller block for product detail (CR-01 §E) — no contact/PII (view-backed). */
export interface PublicVendor {
  vendorId: string;
  displayName: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  markets: Market[];
  memberSince: string | null;
}

/**
 * A product resolved for a specific MARKET (CR-01 §A/§B). The market's `product_prices`
 * row is flattened onto the product so cards/detail read one shape and NEVER see any
 * other market's numbers. Currency is the market's currency (derived, never guessed).
 */
export type MarketProduct = Product & {
  market: Market;
  price: number;
  currency: Currency;
  rentalDailyPrice: number | null;
  securityDeposit: number | null;
  /** Per-market base stock (for products WITHOUT variants; variant stock is resolved on detail). */
  stock: number;
};

/** A variant with its stock resolved for the active market (`product_variant_stock`, Q-B1). */
export type MarketVariant = ProductVariant & { stock: number };

/** Review shape (forward-compat — reviews land in Phase 5; reads return []). */
export interface ProductReview {
  id: string;
  rating: number;
  comment: string | null;
}

export interface ProductListResult {
  items: MarketProduct[];
  total: number;
  page: number;
}

export interface ProductDetail {
  product: MarketProduct;
  variants: MarketVariant[];
  reviews: ProductReview[];
}

/**
 * Detail lookup outcome (DC-2): a product is `ok` in the active market, `not_in_market`
 * (exists + active elsewhere, so we show the SOFT "not available here" page with the
 * price hidden — no leak, no hard 404), or `not_found` (gone/never active → real 404).
 */
export type ProductDetailResult =
  | { status: "ok"; detail: ProductDetail }
  | { status: "not_in_market" }
  | { status: "not_found" };

/** Baseline facet counts for the active market (per category / per attribute option). */
export interface CatalogFacets {
  categoryCounts: Record<string, number>;
  optionCounts: Record<string, number>;
  /** Highest available price in the active market — the max-price slider's ceiling. */
  priceCeiling: number;
}

/** The controlled attribute vocabulary (color/size…) for facets + the seller form. */
export interface AttributeOptionView {
  id: string;
  slug: string;
  valueAr: string;
  valueEn: string;
}
export interface AttributeView {
  id: string;
  slug: string;
  keyAr: string;
  keyEn: string;
  input: Enums<"attribute_input">;
  options: AttributeOptionView[];
}

// ===========================================================================
// R3 CHOKE-POINT — every public product read is market-scoped HERE, in one place.
// RLS can't read the request cookie (CR-01 §A.2), so RLS answers "is it public?"
// (status='active' + price is_available) and THIS layer answers "is it in *your*
// market?" via the mandatory `product_prices` inner-join on `market`. Reads are based
// on `product_prices` so the market filter + price sort/filter hit the (market, price)
// index (0008) and a product with no price row in the active market simply cannot be
// returned. No caller may read product prices any other way — the market-isolation
// integration test asserts against these exported functions.
// ===========================================================================

interface ListPriceRow {
  price: number;
  currency: Currency;
  rental_daily_price: number | null;
  security_deposit: number | null;
  stock: number;
  products: Product;
}

/**
 * Resolve the product-id set matching the attribute facets: **OR within** an attribute
 * (any selected option), **AND across** attributes (intersection). Returns `null` when no
 * facets are active (no constraint) or `[]` when facets are active but nothing matches.
 * Kept in the choke-point so the market query can `.in("product_id", …)` the result.
 */
async function resolveFacetProductIds(
  supabase: Db,
  facets: Record<string, string[]>,
): Promise<string[] | null> {
  const attributeSlugs = Object.keys(facets);
  if (attributeSlugs.length === 0) return null;

  const selectedOptionSlugs = Object.values(facets).flat();
  const { data: optionData } = await supabase
    .from("attribute_options")
    .select("id, slug, attribute_definitions!inner(slug)")
    .in("slug", selectedOptionSlugs);
  const optionRows = (optionData ?? []) as unknown as {
    id: string;
    slug: string;
    attribute_definitions: { slug: string };
  }[];

  let intersection: Set<string> | null = null;
  for (const attributeSlug of attributeSlugs) {
    const wanted = new Set(facets[attributeSlug]);
    const optionIds = optionRows
      .filter((row) => row.attribute_definitions.slug === attributeSlug && wanted.has(row.slug))
      .map((row) => row.id);
    if (optionIds.length === 0) return []; // a selected option doesn't exist → no matches

    const { data: attrData } = await supabase
      .from("product_attributes")
      .select("product_id")
      .in("option_id", optionIds);
    const ids = new Set((attrData ?? []).map((row) => row.product_id));
    if (intersection === null) {
      intersection = ids;
    } else {
      const previous: Set<string> = intersection;
      intersection = new Set([...previous].filter((id) => ids.has(id)));
    }
    if (intersection.size === 0) return [];
  }
  return intersection === null ? null : [...intersection];
}

/** The list choke-point. `supabase` is caller-provided so tests can drive it with an anon client. */
export async function queryProductList(
  supabase: Db,
  filters: ProductFilters,
  market: Market,
  facets: Record<string, string[]> = {},
): Promise<ProductListResult> {
  const offset = (filters.page - 1) * filters.limit;

  // Attribute facets constrain the product-id set (resolved first; empty → early out).
  const facetProductIds = await resolveFacetProductIds(supabase, facets);
  if (facetProductIds !== null && facetProductIds.length === 0) {
    return { items: [], total: 0, page: filters.page };
  }

  let query = supabase
    .from("product_prices")
    .select("price, currency, rental_daily_price, security_deposit, stock, products!inner(*)", {
      count: "exact",
    })
    .eq("market", market)
    .eq("is_available", true)
    .eq("products.status", "active");

  if (facetProductIds !== null) query = query.in("product_id", facetProductIds);
  if (filters.category) query = query.eq("products.category_id", filters.category);
  if (filters.rentable) query = query.eq("products.is_rentable", true);
  // Max-price ceiling (Direction A slider) — runs on the ACTIVE market's price (indexed).
  if (filters.maxPrice !== undefined) query = query.lte("price", filters.maxPrice);

  switch (filters.sort) {
    case "price_asc":
      query = query.order("price", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price", { ascending: false });
      break;
    case "top_rated":
      query = query.order("avg_rating", { referencedTable: "products", ascending: false });
      break;
    default: // newest
      query = query.order("created_at", { referencedTable: "products", ascending: false });
  }

  const { data, count } = await query.range(offset, offset + filters.limit - 1);
  const rows = (data ?? []) as unknown as ListPriceRow[];
  return {
    items: rows.map((row) => flattenPrice(row.products, row, market)),
    total: count ?? 0,
    page: filters.page,
  };
}

interface DetailVariantRow {
  id: string;
  product_id: string;
  size: string | null;
  color: string | null;
  sku: string | null;
  product_variant_stock: { market: Market; stock: number }[];
}
interface DetailPriceRow {
  price: number;
  currency: Currency;
  rental_daily_price: number | null;
  security_deposit: number | null;
  stock: number;
  products: Product & { product_variants: DetailVariantRow[] };
}

/** The detail choke-point (DC-2 aware). Also caller-provided `supabase` for tests. */
export async function queryProductDetail(
  supabase: Db,
  id: string,
  market: Market,
): Promise<ProductDetailResult> {
  const { data } = await supabase
    .from("product_prices")
    .select(
      "price, currency, rental_daily_price, security_deposit, stock, products!inner(*, product_variants(id, product_id, size, color, sku, product_variant_stock(market, stock)))",
    )
    .eq("product_id", id)
    .eq("market", market)
    .eq("is_available", true)
    .eq("products.status", "active")
    .maybeSingle();

  if (data) {
    const row = data as unknown as DetailPriceRow;
    const { product_variants: rawVariants, ...productBase } = row.products;
    const product = flattenPrice(productBase, row, market);
    const variants: MarketVariant[] = (rawVariants ?? []).map((variant) => ({
      id: variant.id,
      product_id: variant.product_id,
      size: variant.size,
      color: variant.color,
      sku: variant.sku,
      // Resolve stock for the ACTIVE market only; other markets' numbers never leave here.
      stock: variant.product_variant_stock.find((entry) => entry.market === market)?.stock ?? 0,
    }));
    return { status: "ok", detail: { product, variants, reviews: [] } };
  }

  // No price in this market → is it active elsewhere (soft page) or truly gone (404)?
  const { data: exists } = await supabase
    .from("products")
    .select("id")
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();
  return exists ? { status: "not_in_market" } : { status: "not_found" };
}

/** The facet-count choke-point (baseline: market + active; ignores the current facet selection). */
export async function queryCatalogFacets(supabase: Db, market: Market): Promise<CatalogFacets> {
  const { data: priceData } = await supabase
    .from("product_prices")
    .select("product_id, price, products!inner(category_id, status)")
    .eq("market", market)
    .eq("is_available", true)
    .eq("products.status", "active");
  const priceRows = (priceData ?? []) as unknown as {
    product_id: string;
    price: number;
    products: { category_id: string | null };
  }[];

  const categoryCounts: Record<string, number> = {};
  const ids: string[] = [];
  let priceCeiling = 0;
  for (const row of priceRows) {
    ids.push(row.product_id);
    if (row.price > priceCeiling) priceCeiling = Math.ceil(row.price);
    const categoryId = row.products.category_id;
    if (categoryId) categoryCounts[categoryId] = (categoryCounts[categoryId] ?? 0) + 1;
  }

  // Attribute-option counts for the same in-market active set. A second query keyed on
  // the resolved ids avoids a fragile deeply-nested PostgREST filter. Fine at catalog
  // scale (tally in JS); move to an RPC/materialized count if the catalog grows large.
  const optionCounts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: attrData } = await supabase
      .from("product_attributes")
      .select("option_id")
      .in("product_id", ids);
    for (const attr of attrData ?? []) {
      optionCounts[attr.option_id] = (optionCounts[attr.option_id] ?? 0) + 1;
    }
  }

  return { categoryCounts, optionCounts, priceCeiling };
}

interface AttributeDefinitionRow {
  id: string;
  slug: string;
  key_ar: string;
  key_en: string;
  input: Enums<"attribute_input">;
  sort_order: number;
  attribute_options: { id: string; slug: string; value_ar: string; value_en: string; sort_order: number }[];
}

/** The controlled attribute vocabulary (public read). For the facet sidebar + seller form. */
export async function queryAttributes(supabase: Db): Promise<AttributeView[]> {
  const { data } = await supabase
    .from("attribute_definitions")
    .select("id, slug, key_ar, key_en, input, sort_order, attribute_options(id, slug, value_ar, value_en, sort_order)")
    .order("sort_order");
  const rows = (data ?? []) as unknown as AttributeDefinitionRow[];
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    keyAr: row.key_ar,
    keyEn: row.key_en,
    input: row.input,
    options: [...row.attribute_options]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((option) => ({
        id: option.id,
        slug: option.slug,
        valueAr: option.value_ar,
        valueEn: option.value_en,
      })),
  }));
}

function flattenPrice(
  product: Product,
  price: Pick<
    ListPriceRow,
    "price" | "currency" | "rental_daily_price" | "security_deposit" | "stock"
  >,
  market: Market,
): MarketProduct {
  return {
    ...product,
    market,
    price: price.price,
    currency: price.currency,
    rentalDailyPrice: price.rental_daily_price,
    securityDeposit: price.security_deposit,
    stock: price.stock,
  };
}

// ===========================================================================
// Cached public entry points (D5). The market is part of the cache key/args so EG
// and SA never share an entry; seller writes bust the `products` tag as before.
// ===========================================================================

const fetchProducts = unstable_cache(
  (filters: ProductFilters, market: Market, facets: Record<string, string[]>): Promise<ProductListResult> =>
    queryProductList(createPublicClient(), filters, market, facets),
  ["products-list"],
  { tags: ["products"] },
);

/** Public product list for the active market (cached; market + facets are part of the key). */
export function listProducts(
  filters: ProductFilters,
  market: Market,
  facets: Record<string, string[]> = {},
): Promise<ProductListResult> {
  return fetchProducts(filters, market, facets);
}

/** The controlled attribute vocabulary for the facet sidebar + seller form (cached). */
export function getAttributes(): Promise<AttributeView[]> {
  return unstable_cache((): Promise<AttributeView[]> => queryAttributes(createPublicClient()), ["attributes"], {
    tags: ["attributes"],
  })();
}

/** Public product detail for the active market (cached per id+market; DC-2 aware). */
export function getProductById(id: string, market: Market): Promise<ProductDetailResult> {
  return unstable_cache(
    (): Promise<ProductDetailResult> => queryProductDetail(createPublicClient(), id, market),
    ["product-detail", id, market],
    { tags: ["products", `product:${id}`] },
  )();
}

/** Baseline facet counts for the active market (wired into the sidebar in Task 1.5.4). */
export function getCatalogFacets(market: Market): Promise<CatalogFacets> {
  return unstable_cache(
    (): Promise<CatalogFacets> => queryCatalogFacets(createPublicClient(), market),
    ["catalog-facets", market],
    { tags: ["products"] },
  )();
}

/**
 * The current seller's OWN products (all statuses incl. draft). Session-scoped via
 * the cookie server client — RLS owner policy returns only their rows. NOT cached
 * (per-user, request-scoped). For the seller dashboard ProductManager. Per-market
 * pricing/stock for the editor is wired in Task 1.5.5.
 */
export async function getMyProducts(): Promise<SellerProduct[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("products")
    .select(
      "*, product_prices(*), product_variants(*, product_variant_stock(market, stock)), product_attributes(option_id)",
    )
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as SellerProduct[];
}

/**
 * The public seller block for a product detail page (CR-01 §E) — reads the narrow
 * `public_vendor_profiles` view (no contact/PII). Cached under the `products` tag.
 */
export function getPublicVendor(vendorId: string): Promise<PublicVendor | null> {
  return unstable_cache(
    async (): Promise<PublicVendor | null> => {
      const supabase = createPublicClient();
      const { data } = await supabase
        .from("public_vendor_profiles")
        .select("vendor_id, display_name, avatar_url, is_verified, markets, member_since")
        .eq("vendor_id", vendorId)
        .maybeSingle();
      if (!data?.vendor_id) return null;
      return {
        vendorId: data.vendor_id,
        displayName: data.display_name,
        avatarUrl: data.avatar_url,
        isVerified: data.is_verified ?? false,
        markets: data.markets ?? [],
        memberSince: data.member_since,
      };
    },
    ["public-vendor", vendorId],
    { tags: ["products", `vendor:${vendorId}`] },
  )();
}
