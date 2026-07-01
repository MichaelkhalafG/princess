# PHASE 1.5 — Markets, Multi-Market Pricing & Filterable Attributes · Claude Code Task Pack

> **Project:** Princess — All-in-One Women's Marketplace
> **Phase goal (CHANGE_REQUEST_01 §0 · CR-1A):** Make the catalog **market-aware**. Egypt (EGP) and Saudi (SAR) become self-contained regional markets; a visitor sees only products priced for **their** market, in that currency. Sellers declare the markets they serve and price per market. Products gain **color + size** filterable attributes (controlled vocabulary → clean facets). Product detail shows a **minimal seller block**.
> **Scope (CR-1A only):** A (market isolation + resolution), B (multi-market pricing + per-market stock + seller market declaration), G (**color + size** filterable attributes), E-minimal (seller block: name + market chips). **NOT in this pack:** C/D/F full vendor onboarding + KYC (→ Phase 1.6), §H escrow/OTP/disputes/payouts (→ Phase 2), and everything in the **Explicitly deferred** box below. See **Handoff** at the foot.
> **Database:** migration `0008_markets_pricing.sql` (PROPOSAL, already authored) — `market`/`attribute_input` enums; `product_prices`, `product_variant_stock`, `vendor_markets`, `attribute_definitions`/`attribute_options`/`product_attributes` (seeds **color + size**); `public_vendor_profiles` view; `profiles += market/country/is_verified`; drops the single-market money/stock from `products`/`product_variants`. Seed regenerated per `docs/SEED_REGEN_PLAN.md`.
> **Phase acceptance:** an EG visitor and a SA visitor each browse a correctly-priced catalog in their currency; a product priced for only one market is invisible in the other; sellers covering both markets enter two prices; color + size facets filter the list with counts; product detail shows the seller block. RTL intact on `/ar`, no console errors.
> **Phase DoD:** market isolation proven by an integration test (no cross-market leak) **and** market-aware catalog E2E green in both locales; `typecheck`/`lint` clean; reuse-first (extend `useFilters`/`FilterBar`/`PriceTag`/catalog query — do not fork them); all UI to `DESIGN_RULES.md`; matrix reconciled (no silent skips).
> **Final commit (whole phase):** `feat(markets): regional markets, multi-market pricing, color/size facets`

---

## How to use this file

Each task is a self-contained unit for a single Claude Code session. Run them **in order** — later tasks depend on earlier ones. For each task:

1. Paste the **Prompt** block into Claude Code.
2. Claude works against the **Files** list (creates/edits only those, unless it surfaces a needed addition).
3. Do **not** mark done until every **DoD** checkbox passes (`typecheck`, `lint`, stated tests).
4. The task **REQ-IDs** must be satisfied or explicitly deferred in `REQUIREMENTS_MATRIX.md` — never silently skipped (CLAUDE_RULES §0). Each task states its expected matrix status change.

> ### ⛔ MANDATORY PROJECT STANDARDS — applies to EVERY task below
> Before writing **any** code in **any** task in this file, you must:
> 1. **Read `docs/CLAUDE_RULES.md`** (engineering standards).
> 2. **Read `docs/DESIGN_RULES.md`** (the single source of truth for all UI/UX).
> 3. **Follow both documents fully** before writing any code.
> 4. **Never violate** any rule in either document (see `DESIGN_RULES.md §17 — Forbidden`).
> 5. **Keep the entire application visually consistent** with the established design system (semantic tokens only, typography scale, 8px spacing, the 3 shadows, defined radii, Lucide icons, RTL **logical** properties, no default shadcn theme, no emoji UI). Reuse the Phase-0 shell and the Phase-1 catalog primitives.
>
> A task that breaks a forbidden rule does not pass review. If a needed pattern is missing, add it to the relevant rules doc first, then implement. This instruction is repeated atop every prompt block so it is never skipped.

**Binding rules for every task:** locked stack only (Supabase · Next 14 App Router + TS · Tailwind + shadcn/ui · Vercel · Resend · Tap); no Prisma / next-auth / Cloudinary (C1/C2/C3); no `any` (strong types, generated `database.types.ts`); typed API envelope `{ data } | { error: { code, message, details? } }`; **RLS deny-by-default on every new table**; Arabic-first RTL with no hardcoded UI strings (all copy via `messages/*`); **all UI to `DESIGN_RULES.md`**; surface conflicts instead of silently breaking a rule. **Market ≠ currency ≠ locale** — never conflate them; the market→currency map is `lib/markets.ts` only.

### ⚙️ Environment reality (same as Phases 0/1 — bake into every task)
Claude Code's sandbox **cannot reach the Supabase DB and cannot run `pnpm dev`/`pnpm test:e2e`**. So for every task:
- **Claude Code WRITES** code + the SQL migration and runs `pnpm typecheck` + `pnpm lint` as the sandbox gate.
- **You RUN the live steps** and paste results: `pnpm exec supabase db push` (apply `0008`) → `pnpm db:types` (regen `lib/database.types.ts`) → `SEED_DUMMY=1 pnpm seed:reset` (re-seed to the new shape) → `pnpm dev` (browser) → `pnpm test:e2e`.
- Claude must **not claim** a migration applied, types regenerated, data seeded, or a page rendered — those are your verifications. **Migrations are PROPOSALS you apply.** Claude writes them to be correct on first run and hands you exact commands.

---

## 🟢 Decisions already made (APPROVED — do NOT re-litigate)

Build to these; they are settled. (Full rationale: `CHANGE_REQUEST_01.md` decisions banner + §A/§B/§G, plus the CR-1A scope-refinement additions.)

- **Markets are `EG` and `SA`** (`market` enum). **Market is separate from locale** (`ar`/`en`) — the 4 combos `{ar,en}×{EG,SA}` are all valid (an Egyptian shopping in English = `en`+`EG`+`EGP`).
- **Currency is derived from market**, never entered twice: `EG→EGP`, `SA→SAR`, via `lib/markets.ts`. `product_prices.currency` is stored for money-row consistency and CHECK-enforced to match the market (Q-B2).
- **Multi-market pricing via a child table** `product_prices` (not `price_eg`/`price_sa` columns) — one row per `(product, market)`; both-market sellers enter **two explicit prices** (no auto-conversion).
- **Per-market stock (Q-B1):** no-variant → `product_prices.stock`; with variants → `product_variant_stock(variant_id, market)`.
- **Seller declares markets; covering a market needs an APPROVED local presence** (`vendor_markets.is_approved`, admin-set). In 1.5 the seed sets `is_approved=true` via service-role; the real approval UI is Phase 1.6.
- **Market resolution = explicit first-visit chooser (Q-A):** order = cookie `market` → `profiles.market` → first-visit **MarketChooser** (geo is only a pre-highlighted hint via `request.geo.country`, never auto-committed). Persist to cookie + (if logged in) `profiles.market`. A **MarketSwitcher** (sibling to `LocaleSwitcher`) lets the visitor change it anytime.
- **Market visibility filter lives in the QUERY layer, not RLS** (RLS can't read the cookie). RLS enforces `status='active'` + `is_available`; the query adds `inner join product_prices … where market = :active` (CR §A.2). **This is the market-leak risk — R3, proven closed in Task 1.5.3.**
- **Attributes = COLOR + SIZE (decided).** `attribute_definitions` seeds **`color` + `size`** (both `multiselect`), each with a **controlled `attribute_options` vocabulary** (admin-managed). Sellers **pick from options — NO free text** (so faceting stays clean). `0008` seeds the vocab. Facets in the URL: `?attr_color=<slug>,<slug>` / `?attr_size=<slug>` (multi-valued), consistent with `useFilters` (URL = single source of truth). The catalog query facets by **color + size + category + price + rentable**, market-isolated, with **computable facet counts** (like the existing category filter).
- **E-minimal seller block ships here:** product detail shows business/display name + approved market chips, via the `public_vendor_profiles` view. `is_verified` exists (default false) but the **verified badge is a placeholder** until Phase 1.6 KYC flips it. Full rating rollup waits for `reviews` (Phase 5).

---

## ⛔ Explicitly deferred — do NOT build in CR-1A (recorded so the design/backend match, not lost)

These appear in the Direction-A sidebar / product cards as **placeholders only**. Building them is a later phase; wiring them now is out of scope and a review failure.

| Item | Status in CR-1A | Where it lands |
|---|---|---|
| **Wishlist heart** | UI-only placeholder (renders, does nothing) | NEW favorites feature, later phase (needs account/favorites store) — roadmap in `IMPLEMENTATION_PLAN.md` |
| **Reviews / ratings** (rating filter + card stars) | Non-functional placeholders (stars/filters render static) | **Phase 5** (`reviews`) — unchanged |
| **Verified badge** | Column exists (`is_verified`, default false); badge is a placeholder | **Phase 1.6** (KYC sets `is_verified`) |
| **Brand** | **Do NOT add a `brand` column.** Model it as a product attribute later if needed | later attribute addition, or defer |

> Task 1.5.4 explicitly renders the rating filter + card stars + wishlist heart as **placeholders** so the sidebar matches Direction A without pretending the features exist.

---

## ✅ Decisions confirmed (2026-07-01) — build to these

- **DC-1 — MarketChooser = lightweight BLOCKING modal on first visit** (no market cookie yet), pre-highlighting the geo guess with EG/SA cards; confirm = commit. **Geo-unavailable fallback = highlight EG** (Egypt is the primary launch market). **`DEFAULT_MARKET = 'EG'` in `lib/markets.ts`.**
- **DC-2 — Out-of-market product deep link = SOFT "not available in your market" page** (NOT a hard 404). **Price fully hidden (no leak)**; the "switch market" CTA routes through the normal **MarketSwitcher**. Preserves market invisibility while staying friendly for shared WhatsApp links.
- **DC-3 — Global attributes only for launch: COLOR + SIZE.** Category-scoped attributes deferred.

---

## Task index

| # | Task | Key REQ-IDs |
|---|------|-------------|
| 1.5.1 | Apply migration `0008` + regenerate the dummy seed to the market shape | REQ-PROD-07/08, REQ-MKT-01/03, REQ-PROD-09 (data) |
| 1.5.2 | Market resolution — `lib/markets.ts`, cookie + `profiles.market`, middleware, MarketChooser + MarketSwitcher | REQ-MKT-01/02 |
| 1.5.3 | `product_prices` in the catalog query / `ProductCard` / `PriceTag` — market-filtered + **market-isolation integration test (R3 proof)** | REQ-MKT-01/03, REQ-PROD-01/03/07, REQ-NFR-05 |
| 1.5.4 | Color + size facets (sidebar sections + counts) · `ProductForm` option selects · admin `GET/PUT /api/admin/attributes` · Direction-A placeholders | REQ-PROD-09, REQ-PROD-02, REQ-DASH-05 |
| 1.5.5 | Seller pricing + market UI — two-price `ProductForm`, `GET/POST /api/vendor/markets`, minimal seller block on detail | REQ-PROD-05/07/08, REQ-VEND-03 (minimal) |
| 1.5.6 | Extend catalog **E2E** for markets + attributes — both locales | REQ-MKT-02, REQ-PROD-02/09 |
| 1.5.7 | Phase 1.5 **DoD gate** — typecheck/lint, tests green, Vercel preview env, matrix reconcile | Phase DoD |

---

## Task 1.5.1 — Apply migration `0008` + regenerate the dummy seed

**REQ-IDs:** REQ-PROD-07 (multi-market pricing + per-market stock), REQ-PROD-08 (seller market declaration), REQ-MKT-01/03 (market isolation data), REQ-PROD-09 (color/size data for facets)

**Objective:** Apply the already-authored `0008_markets_pricing.sql` (you run it), regenerate types, and rewrite `scripts/seed-dummy.ts` to the market shape per `docs/SEED_REGEN_PLAN.md` so every later task and test has EG+SA data with color/size attributes.

> ⚠️ `0008` DROPS `products.price/currency/stock` + `product_variants.stock`. The current seed writes those and will stop typechecking after `pnpm db:types` — this task fixes that. `0008` is a **closed-phase follow-up**; only dummy data exists, so it is a clean cut.

**Prompt:**
```
MANDATORY FIRST STEPS (before any code): read docs/CLAUDE_RULES.md + docs/DESIGN_RULES.md and follow both fully.

Context: supabase/migrations/0008_markets_pricing.sql is already written (a PROPOSAL the user applies). Do NOT rewrite it unless you find a defect — if you do, surface it, don't silently patch. Your job is the SEED rewrite per docs/SEED_REGEN_PLAN.md (read it fully first).

Rewrite scripts/seed-dummy.ts to the post-0008 schema:
1. Types from the REGENERATED lib/database.types.ts: drop price/currency/stock from the products insert; add product_prices, product_variant_stock, vendor_markets, product_attributes inserts. Add CURRENCY_BY_MARKET = { EG:"EGP", SA:"SAR" } (mirror lib/markets.ts).
2. Seller coverage: seed-seller-1 → EG+SA (dual pricing), seed-seller-2 → SA only, seed-seller-3 → EG only. Upsert APPROVED vendor_markets (is_approved:true via service-role) with branch_name + branch_address:{city} (EG→Cairo, SA→Riyadh). => products end up spread across both markets, some single-market and some both-markets.
3. Products carry only market-agnostic fields. For each product × each of its seller's markets, insert a product_prices row (currency derived, plausible INDEPENDENT price, stock for no-variant products, rental fields when is_rentable, is_available:true). PRICES PER MARKET, STOCK PER MARKET.
4. For each variant × each seller market, insert a product_variant_stock row.
5. Attributes = COLOR + SIZE: read the 0008-seeded attribute_options (join attribute_definitions) and assign ≥1 color to every product, and ≥1 size to apparel/dresses/abayas/bridal/shoes (leave makeup/fragrances size-less). Multiple colors/sizes per product are fine (both multiselect). Align sizes/colors with a product's variants where present. NO free text — options only.
6. FK-safe insert order: sellers → vendor_markets → categories → products → product_prices → variants → product_variant_stock → product_attributes. Keep the SEED_DUMMY=1 + non-prod guards, the deterministic PRNG, chunking at 100, and the revalidate ping. Stay no-any, service-role, dev-only.
Log per-market active counts.

Run pnpm typecheck + pnpm lint. Then STOP and give me the exact command sequence to apply + seed. Do NOT claim the migration applied or data seeded.
```

**Files:** `scripts/seed-dummy.ts` (rewrite); read-only: `supabase/migrations/0008_markets_pricing.sql`, `docs/SEED_REGEN_PLAN.md`, `lib/markets.ts` (once 1.5.2 lands — if 1.5.1 runs first, inline the map and refactor to import it in 1.5.2).

**You run (live):**
```bash
pnpm exec supabase db push        # apply 0008 (PROPOSAL → applied by you)
pnpm db:types                     # regen lib/database.types.ts
SEED_DUMMY=1 pnpm seed:reset      # wipe + reseed to the market shape
```

**DoD:**
- [ ] `pnpm typecheck` + `pnpm lint` clean (against the regenerated types).
- [ ] `pnpm db:types` produces `product_prices`/`product_variant_stock`/`vendor_markets`/`attribute_*`/`product_attributes` + `public_vendor_profiles`; `products`/`product_variants` no longer expose the dropped columns.
- [ ] `seed:reset` succeeds; both EG and SA report active products; `seed-seller-1` products have EGP **and** SAR prices; a SA-only and an EG-only seller exist; products carry color/size values.
- [ ] Matrix: REQ-PROD-07/08 → In progress; REQ-PROD-09 data present.

---

## Task 1.5.2 — Market resolution (lib/markets.ts, cookie + profile, middleware, chooser + switcher)

**REQ-IDs:** REQ-MKT-01 (isolation), REQ-MKT-02 (resolution, separate from locale)

**Objective:** Resolve the active market on every request, persist the visitor's explicit choice, and expose a first-visit **MarketChooser** + always-available **MarketSwitcher** — without disturbing the existing `next-intl` locale middleware.

**Prompt:**
```
MANDATORY FIRST STEPS (before any code): read docs/CLAUDE_RULES.md + docs/DESIGN_RULES.md and follow both fully. Reuse the LocaleSwitcher pattern for the MarketSwitcher; do not fork the i18n middleware — compose with it.

Per CHANGE_REQUEST_01 §A (Q-A) and the DC-1 decision:
1. lib/markets.ts — single source of truth: MARKETS = ['EG','SA'] as const; Market type; CURRENCY_BY_MARKET map (EG→EGP, SA→SAR); helpers marketToCurrency(m), isMarket(x), DEFAULT_MARKET = 'EG' (DC-1 fallback — Egypt is the primary launch market). No conversion logic — markets are independent.
2. Resolution (server): read the `market` cookie → else profiles.market (if authed) → else null (unresolved → chooser). Add getActiveMarket() usable in RSC + route handlers. NEVER trust a client market param except an admin/testing ?market= override (guard it).
3. middleware.ts — after the next-intl locale step, resolve market in parallel and stash it (request header/cookie) for the app to read. Vercel request.geo.country → EG/SA is only a HINT used to pre-highlight the chooser; it must NOT auto-commit. When geo is unavailable/ambiguous, pre-highlight DEFAULT_MARKET ('EG'). Keep locale + market orthogonal (4 combos).
4. Server action / route POST /api/market (and GET) to set the cookie and, if logged in, write profiles.market (uses the user's own session — the 0008 column grant allows market/country).
5. UI: MarketChooser (first-visit per DC-1) + MarketSwitcher (sibling to LocaleSwitcher in the header). All copy via messages/* (add market.* keys in en.json + ar.json, both). RTL logical properties. Changing market triggers a catalog re-fetch/re-price.

Add messages keys for both locales. Run pnpm typecheck + pnpm lint.
```

**Files:** `lib/markets.ts` (new), `middleware.ts` (edit — compose with locale), `app/api/market/route.ts` (new) or a server action, `components/shared/MarketSwitcher.tsx` (new), `components/shared/MarketChooser.tsx` (new), header/layout wiring, `messages/en.json` + `messages/ar.json` (new `market` namespace). Read-only: existing `LocaleSwitcher`, i18n config.

**DoD:**
- [ ] `typecheck` + `lint` clean.
- [ ] First visit (no cookie) shows the chooser per DC-1; choosing writes the cookie (+ `profiles.market` when logged in); the switcher changes it thereafter.
- [ ] Locale and market are independent (switching one never changes the other); all 4 combos reachable; RTL correct on `/ar`.
- [ ] No hardcoded market/currency strings; the map lives only in `lib/markets.ts`.
- [ ] Matrix: REQ-MKT-01/02 → In progress/Built as appropriate.

---

## Task 1.5.3 — `product_prices` in the catalog query + `ProductCard`/`PriceTag` + market-isolation integration test (⚠ R3)

**REQ-IDs:** REQ-MKT-01/03 (market-filtered visibility + isolation), REQ-PROD-01/03/07 (list + detail read the market price), REQ-NFR-05 (data boundary)

> **⚠️ RISK R3 (CR §7) — market leak. This is the load-bearing task.** RLS cannot read the request cookie, so the market filter lives in the query layer. If any read path forgets the `inner join product_prices … where market = :active`, cross-market products/prices leak. **Centralize the market filter in one place** (`features/catalog/queries.ts`) so no caller can bypass it, and **prove it with the integration test bundled in this same task** (the test is the acceptance proof of the query).

**Prompt:**
```
MANDATORY FIRST STEPS (before any code): read docs/CLAUDE_RULES.md + docs/DESIGN_RULES.md and follow both fully. Reuse PriceTag/Money and the existing unstable_cache tag strategy (D5) — extend, don't fork.

Per CHANGE_REQUEST_01 §A.2/§B (Q-A/Q-B1) and DC-2:
1. features/catalog/queries.ts — make EVERY product read market-scoped in ONE central place. The list query and the detail query INNER JOIN product_prices ON product_id AND market = :activeMarket AND is_available, returning that market's price block (price, currency, rental fields, stock). A product with no price row in the active market is NOT returned (list); on detail, render the DC-2 SOFT "not available in your market" page — price fully hidden (no leak), "switch market" CTA via the MarketSwitcher (NOT a hard 404). Resolved stock: variants → product_variant_stock for the active market; else product_prices.stock. Do NOT expose any other market's numbers. Cache key/tag MUST include the market (e.g. tag `products` + vary by market) so EG and SA don't share a cache entry.
2. Price/sort filters operate on product_prices.price for the active market (0008 has the (market, price) index). The `rentable` filter operates on products.is_rentable.
3. Facet COUNTS: the query returns computable facet counts (per category, and — set up here for 1.5.4 — per color/size option) for the ACTIVE market, like the existing category filter, so the sidebar can show counts.
4. ProductCard / PriceTag consume the market price block (currency from the row). No client market math.
5. Detail page: seller block hookup is 1.5.5; here wire the market price + the DC-2 soft "not available in your market" page (price hidden, switch-market CTA).
6. Market-isolation integration test (tests/integration/markets-isolation.test.ts): mirror tests/integration/products-rls.test.ts (opt-in env gating, service-role fixture setup + teardown, self-contained — don't rely on the dev seed). Fixtures: a SA-only seller+active SA-priced product, an EG-only seller+active EG-priced product, a both-market seller+product. Assert on the CENTRAL query with an explicit market context: EG context returns EG + both-market(EGP), NEVER the SA-only product, never any SAR number; SA symmetric; both-market product shows EGP under EG and SAR under SA, never both; a product with no active-market price is absent from the list and its detail resolves to the DC-2 soft page (no price). Tear down all fixtures.

Add any needed messages keys (both locales). Run pnpm typecheck + pnpm lint. In your summary, state how the single choke-point + the integration test close R3.
```

**Files:** `features/catalog/queries.ts` (edit — central market filter + facet counts), catalog list page + `[id]` detail page (edit), `components/catalog/ProductCard.tsx` + `PriceTag`/`Money` (edit), cache/tag helper (edit), `tests/integration/markets-isolation.test.ts` (new). Read-only: `lib/markets.ts`, `tests/integration/products-rls.test.ts` (harness pattern).

**DoD:**
- [ ] `typecheck` + `lint` clean.
- [ ] All product reads go through the single market-scoped query; no ad-hoc `from('products')` price read elsewhere (grep to confirm).
- [ ] EG context shows only EG-priced products in EGP; SA only SA in SAR; out-of-market detail renders the DC-2 soft page with the price hidden; cache varies by market (no bleed after a switch).
- [ ] `markets-isolation.test.ts` passes (you run it, opt-in flag) and hits the central query (proves R3 closed), not only RLS; teardown leaves no fixtures.
- [ ] Matrix: REQ-MKT-01/03 → Built (verified); REQ-PROD-01/03/07 updated.

---

## Task 1.5.4 — Color + size facets (sidebar sections + counts) · ProductForm selects · admin attributes · Direction-A placeholders

**REQ-IDs:** REQ-PROD-09 (filterable color/size attributes), REQ-PROD-02 (filters extend to facets), REQ-DASH-05 (admin manages the vocabulary)

**Objective:** Turn the seeded **color + size** vocabulary into working **sidebar facets with counts**, let sellers pick option values in `ProductForm`, give admin a minimal manager, and reconcile the Direction-A sidebar (placeholders for deferred features).

> **🎨 Design reconciliation (Direction A sidebar).** The sidebar must gain **new Color + Size facet sections** alongside the existing **category / price / rentable** filters. Per the **Explicitly deferred** box: the **rating filter** and the **card star ratings** render as **non-functional placeholders** (Phase 5), and the **wishlist heart** on cards is a **UI-only placeholder** (later favorites feature). Build the placeholders so the design matches Direction A without wiring behavior — do NOT implement rating/wishlist logic.

**Prompt:**
```
MANDATORY FIRST STEPS (before any code): read docs/CLAUDE_RULES.md + docs/DESIGN_RULES.md and follow both fully. Reuse useFilters (URL = single source of truth) + FilterBar — extend them; do not add a client store.

Per CHANGE_REQUEST_01 §G (Q-G1), attributes = COLOR + SIZE (decided), and the Direction-A sidebar reconciliation:
1. Facet URL contract: ?attr_color=<slug>,<slug> and ?attr_size=<slug>,<slug> (multi-valued), integrated into useFilters alongside category/price/sort/rentable. Back/forward + shareable links must work.
2. Query (features/catalog/queries.ts): filter products to those having matching product_attributes.option_id (AND across attributes color vs size, OR within an attribute's options). The market filter from 1.5.3 still applies. Surface FACET COUNTS per option for the active market (like the category counts) so each option shows a count. Index-friendly (0008 has (attribute_id, option_id)).
3. FilterBar sidebar: add a Color FacetSection and a Size FacetSection (checkbox/multiselect, ar/en labels from the DB rows), each option with its count; render in BOTH the desktop inline sidebar and the mobile Sheet (mirror existing controls). Add data-testids (filter-facet-color, filter-facet-size). ALSO ensure the sidebar shows the rentable filter and the rating filter — but the rating filter is a PLACEHOLDER (static, disabled, labeled coming-soon via messages) per the deferred box.
4. Product cards: keep the star rating + wishlist heart as PLACEHOLDERS only (render per Direction A, no behavior). Do not add rating/wishlist state or endpoints.
5. ProductForm: add color + size option multiselects (from the global vocab), writing attribute_option_ids[] validated against allowed options; createProduct/updateProduct replace product_attributes (full-replace like variants). NO free text.
6. Admin: GET/PUT /api/admin/attributes (service-role) to manage definitions + options; a minimal AttributeManager panel (reuse DataTable).

All labels via messages/* or DB rows (ar/en). Run pnpm typecheck + pnpm lint.
```

**Files:** `features/catalog/queries.ts` (edit — facet filter + counts), `lib/hooks/use-filters.ts` (edit), `components/shared/FilterBar.tsx` (edit — Color/Size FacetSections + placeholder rating filter), `components/catalog/ProductCard.tsx` (edit — placeholder stars + wishlist heart), `components/catalog/ProductForm.tsx` (edit — color/size selects) + its schema/mutations, `app/api/admin/attributes/route.ts` (new), admin AttributeManager (new, reuse `DataTable`), messages keys.

**DoD:**
- [ ] `typecheck` + `lint` clean.
- [ ] Selecting a color/size facet writes `?attr_color=`/`?attr_size=` and filters the list (market filter honored); each option shows a count; clearing restores; links shareable.
- [ ] Sidebar shows Color + Size + category + price + rentable; rating filter renders as a labeled placeholder; card stars + wishlist heart are placeholders (no behavior).
- [ ] Seller can set color/size options on a product (options only, no free text); they persist (full-replace) and drive facets.
- [ ] Admin can add/edit a definition + options (service-role only; RLS blocks non-admin writes).
- [ ] Matrix: REQ-PROD-09 → Built; REQ-PROD-02/REQ-DASH-05 updated; deferred placeholders recorded (not marked done).

---

## Task 1.5.5 — Seller pricing + market UI + minimal seller block on detail

**REQ-IDs:** REQ-PROD-05 (seller CRUD), REQ-PROD-07 (multi-market pricing UI), REQ-PROD-08 (market declaration), REQ-VEND-03 (minimal public seller block)

**Objective:** Let a seller declare markets and enter per-market prices, and show the minimal seller block on product detail.

**Prompt:**
```
MANDATORY FIRST STEPS (before any code): read docs/CLAUDE_RULES.md + docs/DESIGN_RULES.md and follow both fully. Reuse ProductForm/ImageUploader/ProductManager — extend, don't fork.

Per CHANGE_REQUEST_01 §B/§E (Q-A/Q-B1):
1. GET/POST /api/vendor/markets — a seller reads/declares vendor_markets (insert is pending/is_approved=false per RLS; cannot self-approve). Minimal UI in the seller dashboard to declare markets. (Approval remains admin/Phase-1.6; in dev the seed pre-approves.)
2. ProductForm: render a price SET per market the seller is APPROVED for. Both-market sellers see two price sets (EGP + SAR) entered explicitly (no conversion); single-market sees one. Validate every prices[] market against the seller's approved markets. createProduct/updateProduct write product_prices (full-replace per market) and product_variant_stock per market for variants. ProductManager list shows per-market price/stock.
3. Product detail: render a minimal SellerInfoCard from public_vendor_profiles (display name + approved market chips). No contact/PII. The verified badge is a PLACEHOLDER reflecting is_verified (false until Phase-1.6 KYC) — render it but don't imply verification logic exists yet.

Copy via messages/* (both locales), RTL logical props. Run pnpm typecheck + pnpm lint.
```

**Files:** `app/api/vendor/markets/route.ts` (new), seller dashboard market UI (new/edit), `components/catalog/ProductForm.tsx` + `ProductManager.tsx` + mutations/schema (edit), `components/catalog/SellerInfoCard.tsx` (new), detail page (edit), messages keys.

**DoD:**
- [ ] `typecheck` + `lint` clean.
- [ ] A both-market seller enters two prices; a single-market seller one; pricing a non-approved market is rejected (RLS + app guard).
- [ ] Product detail shows the seller block (name + market chips + placeholder badge), no PII.
- [ ] Matrix: REQ-PROD-05/07/08 updated; REQ-VEND-03 → In progress (minimal).

---

## Task 1.5.6 — Extend the catalog E2E for markets + attributes (both locales)

**REQ-IDs:** REQ-MKT-02 (resolution UX), REQ-PROD-02/09 (color/size facets)

**Objective:** Extend `tests/e2e/catalog.spec.ts` so the market chooser/switch and the color/size facets are covered by `pnpm test:e2e` in both `ar` and `en` projects, resilient to seed state.

**Prompt:**
```
MANDATORY FIRST STEPS: read docs/CLAUDE_RULES.md. Extend tests/e2e/catalog.spec.ts (don't fork it); reuse the fixtures + data-testids pattern. Keep public tests resilient to an empty catalog (skip detail-dependent steps when count===0), matching the existing style.

Add (both locales):
1. Market chooser: first visit (clear the market cookie) shows the MarketChooser per DC-1; choosing SA sets the market; assert prices render in SAR (symbol/format). Then switch to EG via MarketSwitcher and assert re-price to EGP and that the product set changes (URL/locale unchanged — market ⟂ locale).
2. No cross-market leak (smoke): a SA-only product title (from the seed) is NOT visible under EG (guard with test.skip if the seed marker isn't present).
3. Facets: open the sidebar, select a color option, assert ?attr_color= in the URL and a filtered list with a count; repeat for a size option; clear restores.
4. Keep the no-console-errors test green (ignore benign resource 404s as before). Do NOT assert on the placeholder rating/wishlist controls (they're non-functional by design).
Add data-testids where needed (market-chooser, market-switcher, filter-facet-color, filter-facet-size) WITHOUT changing existing testids the current tests rely on.
```

**Files:** `tests/e2e/catalog.spec.ts` (edit), `tests/e2e/fixtures.ts` (edit — add `market`/facet message types), component `data-testid`s (edit).

**DoD:**
- [ ] `typecheck` + `lint` clean.
- [ ] `pnpm test:e2e` green in both `ar` and `en` (you run it); market switch re-prices; color + size facets filter; no console errors.
- [ ] No existing test loosened; no existing `data-testid` renamed.

---

## Task 1.5.7 — Phase 1.5 DoD gate (typecheck/lint, tests, preview, matrix reconcile)

**REQ-IDs:** Phase DoD

**Objective:** Close Phase 1.5 to Definition of Done — everything green, preview env documented, matrix reconciled with no silent skips, deferrals recorded.

**Prompt:**
```
MANDATORY FIRST STEPS: read docs/CLAUDE_RULES.md.
1. Run pnpm typecheck + pnpm lint (sandbox gate) and report clean.
2. Produce a Phase-1.5 acceptance checklist (docs/PHASE_1_5_ACCEPTANCE.md, mirror docs/PHASE_1_ACCEPTANCE.md): the live steps I run (db push 0008 → db:types → seed:reset → dev → test:e2e), the markets-isolation integration command, and the PREVIEW-ONLY Vercel env list (none new expected for CR-1A; confirm the picsum allowlist stays dev-only per next.config.mjs NODE_ENV check, never prod).
3. Reconcile REQUIREMENTS_MATRIX.md: REQ-MKT-01/02/03, REQ-PROD-07/08/09 → Built (or explicitly deferred with a changelog line); update the REQ-PROD-01/02/03/05/06 rows touched by CR-1A; record the DEFERRED items (wishlist=later phase, ratings=Phase 5 placeholders, verified badge=Phase 1.6, brand=no column/attribute-later) so nothing is lost; add the phase changelog. Never silently skip (CLAUDE_RULES §0).
4. List anything deferred to Phase 1.6 (KYC/onboarding) or Phase 2 (escrow).
Do NOT claim live steps pass — write the checklist for me to execute; report only the sandbox (typecheck/lint) results as verified.
```

**Files:** `docs/PHASE_1_5_ACCEPTANCE.md` (new), `REQUIREMENTS_MATRIX.md` (edit — final reconcile + deferrals), `SESSION_STATE.md` (edit — phase close note).

**DoD:**
- [ ] `typecheck` + `lint` clean; `pnpm test:e2e` green (you) in both locales; `markets-isolation.test.ts` green (you).
- [ ] `docs/PHASE_1_5_ACCEPTANCE.md` complete; PREVIEW-only env confirmed; picsum allowlist confirmed dev-only.
- [ ] Matrix reconciled; deferrals (wishlist/ratings/verified badge/brand) recorded; deferrals to 1.6/2 explicit.
- [ ] Final commit: `feat(markets): regional markets, multi-market pricing, color/size facets` (you commit + tag).

---

## 🔗 Handoff — what comes AFTER Phase 1.5 (do NOT build here)

Phase 1.5 covers **CR-1A only**. The following are separate, later packs (authored when you reach them — not in this file):

- **Phase 1.6 — Vendor Onboarding & Verification (CR-1B).** Migration `0009_vendor_verification.sql`: `vendor_applications` (multi-role, Q-C1), `vendor_verification` (KYC), the **first private Storage bucket** `verification-docs` + signed-URL admin access, the admin ApprovalsPanel/VerificationPanel, `profiles.is_verified` set on approval (flips the placeholder badge live), the **multi-role capability rewrite** (`middleware.ts` + `lib/rbac.ts` from `role ==` → has-capability, risk R7), and the real `vendor_markets.is_approved` approval flow (dev seed pre-approves in 1.5). Generalizes to providers/planners (F). *Reference: `CHANGE_REQUEST_01.md` §C/§D/§E-full/§F.*
- **Phase 2 — Escrow, Delivery-OTP & Disputes (CR-2).** Folds into commerce: `0004_commerce.sql` (+ paired `0004b_escrow.sql`) — `order_deliveries`, `disputes`, `payouts`, the `settlements` ledger extensions + `vendor_balances` view (held→available→paid + COD-commission netting), `lib/payouts/*` `PayoutProvider` (manual now → Tap Marketplace later), the **first scheduled job** (auto-release, pg_cron/Edge), and the accepted escrow defaults (H-Q2 admin-OTP, H-Q3 72h, H-Q4 release/refund-only, H-Q7 void-COD-debt, H-Q8 pg_cron). **⚖ Raise the §H.8.1 legal/compliance note (platform holding third-party funds in EG/SA) with the client early.** *Reference: `CHANGE_REQUEST_01.md` §H.*
- **Deferred features (roadmap — from the CR-1A scope guard):** **wishlist/favorites** (new feature + account store, later phase), **reviews/ratings** (Phase 5 — the CR-1A placeholders go live), **brand** (model as a product attribute if/when needed — no `brand` column). *Recorded in `IMPLEMENTATION_PLAN.md` roadmap + `REQUIREMENTS_MATRIX.md`.*
- **Phase 4/5 — F rollout:** `service_prices` (Phase 4), drop `event_planners.is_verified` → `profiles.is_verified` (Phase 5, Q-F1).
