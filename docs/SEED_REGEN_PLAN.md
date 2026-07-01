# SEED_REGEN_PLAN.md — Regenerating the dummy catalog for the market/pricing shape (CR-1A · 0008)

> **Status:** PROPOSAL — companion to `supabase/migrations/0008_markets_pricing.sql`. Describes the rewrite of `scripts/seed-dummy.ts` (dev-only) required after `0008` moves price/currency/stock off `products`/`product_variants` into the new market tables. **No code is written yet** — this is the plan for Task 1.5.1 (`PHASE_1_5_TASKS.md`). The sandbox can't reach Postgres; **you** run the seed from your terminal.

## Why the seed must change

`0008` **drops** `products.price/currency/rental_daily_price/security_deposit/stock` and `product_variants.stock`. The current `scripts/seed-dummy.ts` writes those columns directly (`buildCatalog` → `products.push({price, currency, stock, …})`, `buildVariants` → `stock`). After `0008` + `pnpm db:types`, `TablesInsert<"products">` no longer has those keys, so the script **won't typecheck** until rewritten. Pricing/stock move to `product_prices` / `product_variant_stock`, gated by per-market `vendor_markets`. Dummy data is disposable, so this is a clean re-seed (CR §7 R2).

## Target data shape (after re-seed)

| Concern | Before (0003) | After (0008) |
|---|---|---|
| Product money | `products.price` + `products.currency` | `product_prices(product_id, market, currency, price, rental_daily_price?, security_deposit?, stock, is_available)` — one row **per market the seller covers** |
| No-variant stock | `products.stock` | `product_prices.stock` (per market) |
| Variant stock | `product_variants.stock` | `product_variant_stock(variant_id, market, stock)` (per market) |
| Seller market presence | (none) | `vendor_markets(vendor_id, market, branch_name, branch_address, is_approved=true)` — set approved via service-role |
| Facets | (none) | `product_attributes(product_id, attribute_id, option_id)` referencing the **color + size** vocab seeded by `0008` |

## Seller → market assignment (spans BOTH markets + exercises multi-market)

Keep the 3 `@seed.princess.test` sellers; give them deliberate coverage so the isolation test has data on both sides **and** one seller has two prices per product:

| Seller | Markets (approved) | Purpose |
|---|---|---|
| `seed-seller-1` (أزياء الأميرة) | **EG + SA** | multi-market → each of its products gets **two** `product_prices` rows (EGP + SAR) → exercises the two-price `ProductForm` and cross-market presence |
| `seed-seller-2` (بيت الجمال) | **SA only** | SA-exclusive products → must be **invisible** to an EG visitor (isolation test) |
| `seed-seller-3` (لمسة أناقة) | **EG only** | EG-exclusive products → must be **invisible** to a SA visitor (isolation test) |

This guarantees: (a) both EG and SA each have active products; (b) at least one product exclusive to each market (for the market-leak assertions); (c) a multi-market seller with dual pricing.

## Rewrite steps for `scripts/seed-dummy.ts`

1. **Types.** Add `type Market = Enums<"market">`; `type ProductPriceInsert = TablesInsert<"product_prices">`; `type VariantStockInsert = TablesInsert<"product_variant_stock">`; `type VendorMarketInsert = TablesInsert<"vendor_markets">`; `type ProductAttributeInsert = TablesInsert<"product_attributes">`. Drop `price/currency/stock` from the `ProductInsert` push. Add a fixed map `const CURRENCY_BY_MARKET: Record<Market, Currency> = { EG: "EGP", SA: "SAR" }` (mirrors `lib/markets.ts`).
2. **Seller coverage.** Extend the `SEED_SELLERS` list with a `markets: Market[]` field per the table above. In `ensureSellers`, after promoting to `active`, **upsert approved `vendor_markets`** for each seller/market (`onConflict: "vendor_id,market"`, `is_approved: true`, a `branch_name`, and `branch_address: { city }` — e.g. EG→"Cairo", SA→"Riyadh"). Approving via service-role is legitimate here (admin bypasses the no-self-approve RLS).
3. **Products.** `buildCatalog` builds `products` rows with **only** market-agnostic fields (`id, seller_id, category_id, title, description, is_rentable, images, status`). Remove `price/currency/stock/rental_daily_price/security_deposit`.
4. **Prices.** For each product, for **each market of its seller**, push a `product_prices` row: `market`, `currency = CURRENCY_BY_MARKET[market]`, a `price` drawn from the category range (optionally scale SAR≈EGP×0.08 for realism — deterministic via the existing PRNG, **no auto-conversion implied**, just plausible independent numbers), `stock` for no-variant products, `rental_daily_price`/`security_deposit` when `is_rentable`, `is_available: true`.
5. **Variant stock.** In `buildVariants`, stop writing `stock` on the variant. After variants are inserted, for each variant push a `product_variant_stock` row **per seller market** with `stock = randInt(0,30)`.
6. **Attributes (color + size).** `0008` seeds the global `color` + `size` vocab. The seed **reads** `attribute_options` (join `attribute_definitions`) into a map `(defSlug → optionId[])`, then for each product deterministically assigns **≥1 color and, for apparel/dresses/abayas/bridal/shoes, ≥1 size** (multiple colors/sizes per product are fine — both attributes are `multiselect`). Leave a few products with no size (e.g. makeup/fragrances) so the facet query is exercised with and without matches. `onConflict: "product_id,option_id"`. Align a product's assigned sizes/colors with its variants where they exist, so facets and variants are coherent.
7. **Insert order (FK-safe).** sellers → vendor_markets → categories → products → product_prices → variants → product_variant_stock → product_attributes. Chunk at 100 as today.
8. **Idempotency / reset.** `wipeDummyProducts` already deletes the sellers' `products`; the new child tables (`product_prices`, `product_variant_stock`, `product_attributes`) **cascade** on product/variant delete, so no extra wipe is needed. `vendor_markets` is re-upserted. `seed:reset` still deletes the sellers (cascades everything). Keep the `SEED_DUMMY=1` + non-prod guards unchanged.
9. **Guards / logging.** Keep the dev-only guard, the deterministic PRNG (bump the seed constant if you want fresh data), and the best-effort `/api/dev/revalidate` ping. Log per-market counts (e.g. `EG active: N, SA active: M`) so you can eyeball isolation.

> Everything stays `no-any`, service-role, dev-only. `picsum.photos` image URLs are unchanged and remain behind the **dev-only** `next.config.mjs` allowlist (never prod).

## Commands (you run these — sandbox can't reach the DB)

```bash
# 1. apply the proposal migration
pnpm exec supabase db push

# 2. regenerate types so the seed (and app) see the new tables / dropped columns
pnpm db:types

# 3. wipe + reseed to the new market shape (SEED_DUMMY=1 must be in .env.local)
pnpm seed:reset      # = tsx scripts/seed-dummy.ts --reset

# (subsequent refreshes without wiping sellers)
pnpm seed:dummy
```

## Post-seed acceptance (feeds Task 1.5.5 / 1.5.6)

- As **anon**, `product_prices` join shows active products in **both** EG and SA.
- An **EG** context never returns `seed-seller-2` (SA-only) products; a **SA** context never returns `seed-seller-3` (EG-only) products — the market-isolation integration test asserts this.
- `seed-seller-1` products return an EGP price under EG and a SAR price under SA (dual pricing).
- Facet options (**color / size**) resolve to real products in each market (some products carry both, some only color).
