# REQUIREMENTS_MATRIX.md

> **Project:** Princess — All-in-One Women's Marketplace
> **"The law" (CLAUDE_RULES §0).** Every implementation task MUST cite a `REQ-ID`. Nothing ships without a matching row. When a requirement changes, **edit the row + add a changelog line** — never delete history.
> **This file supersedes the previous matrix.** Columns are now: **REQ-ID | Description | Priority | Phase | Status | Notes**.
> **Priority:** `P0` must / never cut (payment, RBAC, availability, core flows) · `P1` core · `P2` deferrable.
> **Status:** `Not started` · `In progress` · `Built` · `Deferred`.
> **Phase** maps to `IMPLEMENTATION_PLAN.md` (0–7).

---

## Locked decisions (confirmed 2026-06-28)

| Decision | Resolution |
|---|---|
| Stack | Supabase (DB/Auth/Storage/Realtime) · Next.js 14 + TS · Tailwind + shadcn/ui · Vercel · Resend |
| Notifications | Email (Resend) now; SMS provider-agnostic, **Twilio = Phase 2** |
| Payments | `PaymentProvider` abstraction; **Tap primary**, Stripe deferred |
| i18n | **Arabic-first**, bilingual AR/EN, RTL (`next-intl`) |
| Scope/timeline | Full scope into **5 dev + 2 test days** (risk in PROJECT_ANALYSIS §8) |
| Schema naming | `provider` role · `profile_status` · `portfolio_items` (single source) · `is_paid` generated · `platform_settings`+`platform_upfront_fees` |

---

## A. Authentication & Accounts

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-AUTH-01 | Register (email/password, role at signup) | P0 | 0 | Built | 0.3: `profiles` + `handle_new_user` trigger live. 0.7: `POST /api/auth/register` (Zod, role→user metadata) + RegisterForm + RoleSelect — **E2E-verified** (customer/seller/provider, duplicate→EMAIL_TAKEN, ar+en) |
| REQ-AUTH-02 | Login + session via `@supabase/ssr` | P0 | 0 | Built | 0.2: ssr clients. 0.6: middleware session refresh verified. 0.7: `POST /api/auth/login` + `/logout` + `GET /api/auth/me` + LoginForm role-redirect — **E2E-verified** (login ok, wrong-pass→error, logout, ar+en) |
| REQ-AUTH-03 | Roles: customer/seller/provider/admin | P0 | 0 | Built | 0.3: enum `user_role` (`provider`) + `profiles.role` live; consumed by register/login redirect, middleware guard, RoleGuard, AuthMenu (4 dashboards). **CR-01 (2026-07-01) reconcile (Q-C1):** `profiles.role` becomes **primary/display** — real authorization derives from approved `vendor_applications` per role (see REQ-VEND-05); `middleware.ts`+`lib/rbac.ts` move "role ==" → "has capability" in Phase 1.6 (capability rewrite = R7). Enum/column as-built unchanged |
| REQ-AUTH-04 | Provider type freelancer/center | P1 | 0 | Built | 0.3: `provider_type` enum/column live (data model complete). Provider chooses type during onboarding UI in Phase 4 (carry-forward). **CR-01 (2026-07-01):** `provider_type` now captured via the `vendor_applications` submission (REQ-VEND-01), not a bare signup field |
| REQ-AUTH-05 | Seller/provider admin approval before listing | P0 | 0 | In progress (extended by CR-01) | 0.3: trigger sets non-customers `pending` (live-verified). 0.7: PendingApprovalBanner (status from `/api/auth/me`) — **E2E-verified** (seller+provider show it, customer doesn't). Admin approval UI + listing-disable = Phase 5/admin (carry-forward). **CR-01 (2026-07-01):** approval now requires a submitted `vendor_applications` row (REQ-VEND-01) + KYC (REQ-VEND-02) as the review basis — today the trigger just sets `pending` with nothing to review. **Status Built→In progress (extended by CR-01).** |
| REQ-AUTH-06 | RBAC middleware + RLS enforcement | P0 | 0 | Built | 0.4: `profiles` RLS. 0.6: middleware (intl + session refresh + `/dashboard/*` role guard from DB). 0.7: role-redirect E2E-verified. 0.10: `RoleGuard` component. RLS verified via `tests/integration/rls.test.ts` + SQL block. Per-table RLS as tables land (carry-forward) |

## B. Products (Buy)

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-PROD-01 | Product catalog (dresses/shoes/bags/accessories/cosmetics) | P0 | 1 | In progress (CR-1A re-work) | 1.1 schema/RLS/indexes. 1.6: `GET /api/products` + `listProducts` (active-only, cached tag `products`) + `/products` page (RSC, FilterBar+ProductGrid+Pagination, Suspense skeleton). 1.8: catalog E2E (browse/render/RTL/no-console-errors, ar+en). Sandbox gate green; **live verification = user's `pnpm test:e2e` + Vercel preview (Phase-1 DoD)**. **CR-01 (2026-07-01): market-aware** — catalog now filters by active market (`inner join product_prices`); price/currency/stock moved to `product_prices`/`product_variant_stock` (REQ-PROD-07); re-gate catalog listing in Phase 1.5. **Status reset Built→In progress (CR-1A re-work).** |
| REQ-PROD-02 | Filters/sort (category, price, sort) | P1 | 1 | In progress (CR-1A re-work) | 1.1 indexes. 1.4 `useFilters`/FilterBar (URL state). 1.6: wired into `listProducts` (category_id/price filters; sorts newest/price_asc/price_desc/top_rated, index-backed) + URL pagination. 1.8: E2E asserts filter/sort → URL (single source of truth). Live verify via `pnpm test:e2e` + preview. **CR-01 (2026-07-01):** gains **attribute facets** (`?attr_<slug>=…`, FacetPanel) per REQ-PROD-09; price filter now keys off `product_prices.market`. **Status reset Built→In progress (CR-1A re-work).** |
| REQ-PROD-03 | Product detail page | P0 | 1 | In progress (CR-1A re-work) | 1.6: `GET /api/products/:id` + `getProductById` (cached tag `product:{id}`, 404 when !active) + `/products/[id]` (ProductGallery, VariantSelector, serif PriceTag, `generateMetadata`+OG, reviews placeholder). 1.8: E2E click-through to detail (when a product exists / via seller flow). Live verify via `pnpm test:e2e` + preview. **CR-01 (2026-07-01):** detail returns market price block only (404 if not priced in active market); gains a **seller block** (SellerInfoCard — name/market/verified badge, REQ-VEND-03). **Status reset Built→In progress (CR-1A re-work).** |
| REQ-PROD-04 | Variants (size/color/stock) | P1 | 1 | Built | 1.1: `product_variants` table + unique `(product_id,size,color)` + RLS (public read where parent active / owner via join). 1.7: ProductForm variants editor (`useFieldArray`) + full-replace on save (`productVariantInputSchema`). Live verify via the seller E2E flow + preview |
| REQ-PROD-05 | Seller CRUD (own products) | P0 | 1 | In progress (CR-1A re-work) | 1.1: owner-only RLS (`seller_id = auth.uid()`). 1.7: `createProduct`/`updateProduct`/`deleteProduct` (cookie server client; **`seller_id` from session, never body**; ownership re-check 404/403 **on top of** RLS; `revalidateTag`) · `POST /api/products` (seller-role **+ active** gate, REQ-AUTH-05) + `PUT/DELETE /api/products/:id` · `getMyProducts` + ProductManager. 1.8: RLS owner-isolation integration test (`products-rls.test.ts`, opt-in) + SQL smoke (`products.rls-smoke.md`) + opt-in seller add-with-image E2E. Live verify via the user's runs + preview. **CR-01 (2026-07-01):** `ProductSchema`/`createProduct`/`updateProduct` write `product_prices` rows (`prices[]`, one per approved market) + `attribute_option_ids[]` instead of a single `price`/`currency`; ProductForm shows per-market price sets + attribute selects; writes gated to approved `vendor_markets`. **Status reset Built→In progress (CR-1A re-work).** |
| REQ-PROD-06 | Product images (Supabase Storage) | P0 | 1 | In progress (CR-1A re-work) | 1.2 **verified live**: `/api/upload` (user-session client, RLS-enforced) + `useUpload` + `ImageUploader` (reusable) emit `[{url,alt,sort}]` for `products.images`; guards (BAD_FILE/TOO_LARGE/401). 1.7: wired into ProductForm (`bucket=products`, `parseProductImages` on edit). 1.8: opt-in seller E2E uploads a real image end-to-end. Throwaway dev upload-test harness removed. **CR-01 (2026-07-01):** seed/upload paths become market-aware (dummy data must span EG+SA); the public `products` bucket is unchanged, but the KYC flow adds the first PRIVATE bucket (REQ-VEND-02). **Status reset Built→In progress (CR-1A re-work).** |

## C. Cart, Orders & Checkout

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-CART-01 | Add/view/remove cart | P0 | 2 | Not started | `cart_items` |
| REQ-ORD-01 | Checkout (COD + upfront fee) | P0 | 2 | Not started | `orders` |
| REQ-ORD-02 | My orders | P1 | 2 | Not started | RLS |
| REQ-ORD-03 | Exact COD cash shown at checkout | P0 | 2 | Not started | `orders.cod_amount`; client-repeated |
| REQ-ORD-04 | Order status lifecycle | P1 | 2 | Not started | `order_status`. **CR-01 (2026-07-01):** lifecycle extends with escrow states — `… → delivered → accepted/auto-released` (adds `delivered_at`/`accepted_at`/`auto_release_at` on `orders`; invalid transitions → `409 INVALID_TRANSITION`). See REQ-PAY-08..11 |

## D. Payments (Hybrid)

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-PAY-01 | Upfront fee intent (platform revenue) | P0 | 2 | Deferred → Phase 2 | **Foundation built, not cut.** 0.9 spike VERIFIED vs live Tap sandbox (charge `chg_TS05A…`, INITIATED, `transaction.url`): `TapProvider.createIntent` makes the real `/v2/charges` call (minor→major `toTapAmount`; redirect flow; idempotency via `reference.transaction`). Remaining for Phase 2: checkout intent + `payments` persistence + webhook hashstring-secret confirmation. Shape in `docs/SPIKE_NOTES.md` |
| REQ-PAY-02 | Payment webhook (signed, idempotent) | P0 | 2 | Not started | `payments.idempotency_key` |
| REQ-PAY-03 | Confirm COD (admin/agent) | P0 | 2 | Not started | C9: admin confirms v1. **CR-01 (2026-07-01):** COD collection now happens at **delivery-OTP** (REQ-PAY-09) — `confirm-cod` merges into `POST /api/orders/:id/confirm-delivery` (admin enters OTP on courier's behalf, C9/H-Q2 (a)) |
| REQ-PAY-04 | Paid ONLY when upfront AND COD | P0 | 2 | Not started | **`is_paid` STORED generated col**. **CR-01 (2026-07-01):** two distinct axes — `is_paid` = **buyer-paid** (the *entry condition* to escrow `held`), NOT "vendor paid"; vendor release is tracked separately on `settlements.status` (`held`→`available`→`paid`). Document both explicitly |
| REQ-PAY-05 | Commission settlement before payout | P0 | 2 | Not started | `settlements`. **CR-01 (2026-07-01):** payout only from `available` (not `held`), **netted** against COD-commission debt, and **manual admin disbursement** (was implied auto) — see REQ-PAY-12/13 |
| REQ-PAY-06 | Configurable commission/fees (admin) | P0 | 2 | Built | 0.4: `platform_settings` (15/10/10) + `platform_upfront_fees` (per type×currency, minor units) live, seeded & **RLS-tested** (authenticated-read / service-role-write). Config is the source of truth for money math now; admin settings UI/API = Phase 2 (carry-forward). **CR-01 (2026-07-01):** add `acceptance_window_hours` (default 72) to `platform_settings` for the escrow acceptance window (REQ-PAY-10) |
| REQ-PAY-07 | `PaymentProvider` abstraction (Tap; Stripe later) | P1 | 0 | Done | 0.8 **VERIFIED**: `lib/payments` — `PaymentProvider` interface (createIntent/verifyWebhook/getCaptureStatus, integer minor units, typed envelope, optional `destination` for marketplace split → REQ-PAY-05/Phase 2), `TapProvider` (createIntent sandbox stub → real call in 0.9; webhook verify via **Tap hashstring** scheme, timing-safe + fail-closed), `StripeProvider` stub (NotImplemented), `index.ts` factory (→Tap). Feature code depends on the interface only (CLAUDE_RULES §3). Unit-tested (factory + minor-units guard + webhook round-trip/tamper). 0.9 confirms hashstring secret + per-currency decimals |

## E. Rentals

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-RENT-01 | Rental request (date range) | P0 | 3 | Not started | `rentals` |
| REQ-RENT-02 | Availability — no date overlap | P0 | 3 | Not started | **btree_gist exclusion** |
| REQ-RENT-03 | My rentals | P1 | 3 | Not started | RLS |
| REQ-RENT-04 | Rental status lifecycle | P1 | 3 | Not started | `rental_status` |
| REQ-RENT-05 | Security deposit + booking fee | P0 | 3 | Not started | C8 refundable deposit |

## F. Services & Bookings

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-SVC-01 | Service catalog | P0 | 4 | Not started | `services` |
| REQ-SVC-02 | Service filters (type/price/rating) | P1 | 4 | Not started | indexed |
| REQ-SVC-03 | Service detail + portfolio | P0 | 4 | Not started | `portfolio_items` |
| REQ-SVC-04 | Provider service CRUD | P0 | 4 | Not started | RLS owner. **CR-01 (2026-07-01):** services become **multi-market** — mirror REQ-PROD-07 with a `service_prices` child table `(service_id, market, currency, price, is_available)` when Phase 4 builds services (slots stay market-agnostic; price per-market). CR-01 §F |
| REQ-SVC-05 | Availability slots | P0 | 4 | Not started | `availability` + exclusion |
| REQ-SVC-06 | Beauty-center offers | P2 | 4 | **Deferred** | schema defined; UI deferred (cut-line) |
| REQ-BOOK-01 | Create booking + upfront fee | P0 | 4 | Not started | confirmed on capture |
| REQ-BOOK-02 | My bookings | P1 | 4 | Not started | RLS |
| REQ-BOOK-03 | Provider bookings | P1 | 4 | Not started | RLS |
| REQ-BOOK-04 | Booking status (confirm/complete/cancel) | P0 | 4 | Not started | `booking_status` |
| REQ-BOOK-05 | Realtime slot blocking | P1 | 4 | Not started | bookings exclusion + Realtime |

## G. Event Planning

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-EVT-01 | Planner profiles (specialties/packages) | P1 | 5 | Not started | `event_planners` typed jsonb |
| REQ-EVT-02 | Planner listing + filters (city/specialty) | P1 | 5 | Not started | GIN(specialties) |
| REQ-EVT-03 | Planner detail (packages/portfolio/quote) | P1 | 5 | Not started | |
| REQ-EVT-04 | Quote request | P1 | 5 | Not started | `event_requests` |
| REQ-EVT-05 | Provider request mgmt (accept/decline/complete) | P1 | 5 | Not started | `request_status` |
| REQ-EVT-06 | My event requests (customer) | P2 | 5 | Not started | RLS |
| REQ-EVT-07 | Admin verify planners | P1 | 5 | Not started | `is_verified`. **CR-01 (2026-07-01) (Q-F1):** planner verification **unified into KYC** — **`event_planners.is_verified` is removed**; the planner public-read gate joins `profiles.is_verified` (REQ-VEND-02), and `PUT /api/event-planners/:id/verify` folds into `PUT /api/admin/verifications/:id`. Single source of truth = `vendor_verification` + `profiles.is_verified` |

## H. Portfolio Gallery

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-PORT-01 | Reusable gallery (grid+lightbox) | P1 | 5 | Not started | `PortfolioGallery` |
| REQ-PORT-02 | Profile portfolio | P1 | 5 | Not started | `portfolio_items` (service_id null) |
| REQ-PORT-03 | Service portfolio | P1 | 5 | Not started | `portfolio_items` (service_id set) |
| REQ-PORT-04 | Combined portfolio merge (source tag) | P1 | 5 | Not started | computed `source` |
| REQ-PORT-05 | Portfolio manager (upload/caption/associate/delete/reorder) | P1 | 5 | Not started | `sort_order` |

## I. Reviews & Notifications

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-REV-01 | Create review | P1 | 5 | Not started | `reviews`; verified-purchase gate TBD |
| REQ-REV-02 | List reviews + summary | P1 | 5 | Not started | indexed |
| REQ-REV-03 | Rating aggregation | P1 | 5 | Not started | `reviews_aggregate` trigger |
| REQ-NOT-01 | Email notifications (Resend) | P0 | 5 | Deferred → Phase 5 | **Foundation built, not cut.** 0.8: `lib/notifications` — `NotificationService` interface (`send(template,to,data)`, channel-agnostic), `ResendEmailChannel` (env-keyed, server-only, 5 template keys w/ stub bodies), `SmsChannel` placeholder (Twilio Phase 2, C5), factory. Remaining for Phase 5: real localized templates + triggers wired to flows |
| REQ-NOT-02 | SMS notifications | P1 | — | **Deferred** | Phase 2 Twilio (C5; Resend email-only) |
| REQ-NOT-03 | Scheduled booking reminders | P2 | — | **Deferred** | Phase 2 edge cron |

## J. Dashboards

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-DASH-01 | Customer dashboard | P0 | 2–5 | Not started | orders/rentals/bookings/requests |
| REQ-DASH-02 | Seller dashboard | P0 | 1–2 | Not started | products/orders/revenue |
| REQ-DASH-03 | Provider dashboard | P0 | 4–5 | Not started | services/bookings/portfolio/requests |
| REQ-DASH-04 | Admin dashboard | P0 | 2–5 | Not started | approvals/COD/settings/verify/reports. **CR-01 (2026-07-01):** admin gains new panels — **ApplicationsPanel** (REQ-VEND-01), **VerificationPanel/KYC** (REQ-VEND-02), **DisputesPanel** (REQ-PAY-11) and **PayoutsPanel** ("Mark as paid" on system-computed net, REQ-PAY-12/13; supersedes per-settlement pay) |
| REQ-DASH-05 | Category management | P1 | 1 | In progress | 1.1: `categories` table + RLS + seed. 1.5: **API built** — `GET/PUT /api/admin/categories` (admin-gated server-side; PUT Zod upsert/reorder via service-role + `revalidateTag('categories')`) + cached public `getCategories` (`unstable_cache`, tag `categories`). **Admin CategoryManager UI deferred → admin phase** (Phase 5/admin dashboard) — not needed for Phase-1 catalog (categories consumed read-only by FilterBar/ProductForm). **CR-01 (2026-07-01):** extend admin management to **attribute definitions/options** (the filterable-attribute vocabulary, REQ-PROD-09) alongside categories — new `GET/PUT /api/admin/attributes` |
| REQ-DASH-06 | Reports (sales/revenue/commission) | P2 | 5 | **Deferred** (advanced) | basic now, advanced deferrable |

## K. Non-Functional

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-NFR-01 | RTL + Arabic-first bilingual | P0 | 0 | Built | 0.5: `next-intl` + `[locale]` routing (ar default, en), RTL `dir` per locale, message catalogs — E2E-verified (/→/ar Arabic RTL, /en LTR). 0.10: logical RTL props throughout nav/footer. Per-feature translations land with each feature (expected) |
| REQ-NFR-02 | Mobile responsive / PWA-ready | P0 | 0+ | Built | 0.1: PWA `manifest.webmanifest` + themeColor baseline. 0.10: responsive Navbar/Footer + MobileNav Sheet drawer, mobile-first layouts. Offline/installable hardening = Phase 6/7 (carry-forward) |
| REQ-NFR-03 | RBAC isolation (sellers/providers/admin) | P0 | 0 | Built | 0.4: profiles RLS (deny-by-default + column grants). 0.6: middleware dashboard role guard (DB role). 0.10: `RoleGuard` defense-in-depth. RLS smoke test + SQL block (Phase-0 DoD). Per-table RLS as tables land (carry-forward) |
| REQ-NFR-04 | Performance (RSC, caching) | P1 | all | In progress | 1.6: catalog reads are RSC + `unstable_cache` tags (`products`/`product:{id}`, D5), server-side pagination (D2), index-backed queries, `next/image` with fixed aspect-ratio (zero CLS) + Suspense skeletons matching the card. 1.8: catalog E2E includes a no-console-errors assertion. Broader perf (other features, Lighthouse budgets) ongoing → later phases |
| REQ-NFR-05 | Security (RLS, webhook verify, validation) | P0 | all | Built | Phase-0 posture complete: RLS deny-by-default (`profiles`/settings) + no-escalation column grants (RLS-tested); service-role `server-only`; secrets env-only; middleware anon key + DB role. 0.7: server-side Zod on auth routes. 0.8: provider abstractions `server-only`. 0.9: Tap webhook HMAC verify (fail-closed). Per-route Zod + Tap webhook-secret confirmation as routes land (carry-forward) |
| REQ-NFR-06 | Accessibility WCAG AA | P1 | all | Not started | DESIGN_RULES §10 |
| REQ-NFR-07 | SEO (metadata/sitemap/hreflang) | P1 | all | Built | 0.1/0.5: Next metadata API + viewport themeColor, `lang`/`dir` per locale, favicon, per-page `generateMetadata` (auth). sitemap.xml / robots / hreflang / OpenGraph = Phase 6/7 (carry-forward) |
| REQ-NFR-08 | Elegant feminine design (peach/rose-gold/white) | P0 | 0+ | Built | 0.1: brand tokens, type scale, 3 shadows, radii, Lucide; shadcn restyled (not default). 0.10: Navbar/Footer/MobileNav/LocaleSwitcher + real Rose-Jewel logo, premium landing hero. Navbar feel iterated with user (light ivory, presence). Per-screen polish ongoing as features land |
| REQ-NFR-09 | Scalability/maintainability (enterprise/modular) | P0 | all | Not started | feature modules |
| REQ-NFR-10 | Testing (unit/integration/E2E; COD thorough) | P0 | 6 | Built | Phase-0 scope: Vitest unit (auth schema + providers + Tap webhook/amount = 24 tests); Playwright auth E2E **16/16** (ar+en); RLS smoke `tests/integration/rls.test.ts` (opt-in) + SQL block. Full-flow E2E (buy/rent/book/quote) + exhaustive COD/webhook + per-table RLS tests = Phase 6 (carry-forward) |
| REQ-NFR-11 | Deployment (Vercel + Supabase) | P0 | 0/7 | Built | Supabase live (0001+0002). 0.11: **green Vercel deploy at `princess-woad.vercel.app`** — 7/7 acceptance checks pass (live-verified). ⚠️ Shipped to Production from `main` with **sandbox/placeholder keys** (no real payments/emails); real launch hardening (live Tap/Marketplace, replace TAP_WEBHOOK_SECRET + RESEND_API_KEY placeholders, re-enable Confirm email, legal entity) = Phase 7. **CR-01 (2026-07-01):** ⚖ KYC is pulled **earlier than Phase 7** (into Phase 1.6, REQ-VEND-02); and a new **legal/compliance flag** — the platform **holding third-party funds** in escrow (single Tap merchant, EG/SA) may carry e-money/payment-intermediary/escrow **regulatory implications** the client must verify (not legal advice). Add to the go-live checklist. Ref CR-01 §H.8.1 |
| REQ-NFR-12 | Storage in Supabase buckets | P0 | 1 | Built | 1.2 **verified live**: `products` bucket (public) + Storage RLS (public read / owner write under `{uid}/…`) applied; `lib/storage/buckets.ts` (typed bucket names + path builder), `POST /api/upload` (validates `PRODUCT_IMAGE_LIMITS`, no service-role — RLS via user session). Replaces Cloudinary (C3). Other buckets (avatars/services/portfolio) added per-phase via the same pattern |

## L. AI

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-AI-01 | Smart recommendations | P2 | — | **Deferred** | Phase 3; needs interaction data + pgvector |

## M. Markets & Vendor Verification (CR-01)

> Added by **CR-01** (approved 2026-07-01; `docs/CHANGE_REQUEST_01.md`). New work packages: **CR-1A** = Phase 1.5 (markets + multi-market pricing + filterable attributes), **CR-1B** = Phase 1.6 (vendor onboarding + KYC + multi-role), **CR-2** = folded into Phase 2 (escrow/OTP/disputes/payouts). See the CR-01 changelog line below.

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-MKT-01 | Regional market isolation (EG/SA self-contained: local currency, shipping, COD; no FX/cross-border) | P0 | 1.5 | In progress | CR-01 §A. Hardens conflict `C10` from "per-region currency" to full visibility/fulfillment isolation. `market` enum + `lib/markets.ts` map landed (Task 1.5.2); catalog visibility isolation enforced in the query layer + proven by the isolation test in Task 1.5.3 |
| REQ-MKT-02 | Market resolution (first-visit chooser; geo is hint only; cookie→`profiles.market`), separate from locale | P0 | 1.5 | In progress | CR-01 §A (Q-A). **Task 1.5.2 built:** `lib/markets.ts` (single source, `DEFAULT_MARKET='EG'`), `getActiveMarket()` (cookie→profile→null), geo hint in `middleware.ts` (never auto-commits), `GET/POST /api/market`, MarketChooser (blocking first-visit modal) + MarketSwitcher (sibling to LocaleSwitcher); 4 locale×market combos. E2E pending Task 1.5.7 |
| REQ-MKT-03 | Market-filtered catalog visibility (product invisible if no price in the active market) | P0 | 1.5 | In progress | CR-01 §A.2/§B. **Task 1.5.3 built:** single query choke-point `features/catalog/queries.ts` (`queryProductList`/`queryProductDetail` inner-join `product_prices` on `market`), market in the cache key, DC-2 soft "not available" page (no price leak). **Closes R3.** Verify by running `tests/integration/markets-isolation.test.ts` (MARKET_TEST=1) |
| REQ-PROD-07 | Multi-market pricing (`product_prices`) + per-market stock (`product_variant_stock`) | P0 | 1.5 | In progress | CR-01 §B (Q-B1). **Task 1.5.5 built:** `productSchema.prices[]` (currency derived), per-market variant stock; `createProduct`/`updateProduct` full-replace `product_prices` + `product_variant_stock`; `ProductForm` renders one price set per approved market (two → EGP+SAR); `ProductManager` shows per-market price/stock. No auto-conversion. Verify via live browser + seller E2E (1.5.7) |
| REQ-PROD-08 | Seller market declaration + local-presence requirement (`vendor_markets.is_approved`) | P0 | 1.5 | In progress | CR-01 §B. **Task 1.5.5 built:** `GET/POST /api/vendor/markets` (declare → pending; RLS forbids self-approve), `VendorMarkets` UI, and a mutation guard rejecting prices for non-approved markets. Admin approval UI is Phase 1.6; seed pre-approves in dev |
| REQ-PROD-09 | FILTERABLE product attributes (controlled vocabulary; faceted filters) | P1 | 1.5 | In progress | CR-01 §G (Q-G1). **Promoted P2→P1.** Launch vocab = **color + size** (0008). **Task 1.5.4 built:** `?attr_color=`/`?attr_size=` in `useFilters` (URL SoT), market-scoped facet filter (AND-across/OR-within) + counts in the query choke-point, Color/Size sidebar sections, `ProductForm` option multiselects → `product_attributes` full-replace, `GET/PUT /api/admin/attributes` + AttributeManager. Rating filter + card stars + wishlist heart are deferred placeholders. Seller-form pieces verify once 1.5.5 clears the price columns |
| REQ-VEND-01 | Vendor onboarding application (business data + sample images) | P0 | 1.6 | Not started | CR-01 §C. New `vendor_applications` (one row per `(applicant_id, role)`, Q-C1); the review basis for approval (extends REQ-AUTH-05) |
| REQ-VEND-02 | KYC identity verification (private docs, admin review, `profiles.is_verified`) | P0 | 1.6 | Not started | CR-01 §D. New `vendor_verification` + `verification_status` enum + **first PRIVATE bucket** `verification-docs` (signed-URL admin read). Pulls KYC earlier than Phase 7 (see REQ-NFR-11) |
| REQ-VEND-03 | Public vendor info + verification badge on detail (explicit public/private field set) | P1 | 1.5/5 | In progress | CR-01 §E. **Task 1.5.5 built (minimal):** `SellerInfoCard` on product detail (display name + approved market chips) via `getPublicVendor` → `public_vendor_profiles` view (no contact/PII). Verified badge renders only when `is_verified` (placeholder until Phase-1.6 KYC). Full card w/ rating rollup completes with `reviews` (Phase 5) |
| REQ-VEND-04 | Same onboarding/KYC/markets/public-info rules for providers + planners | P0 | 1.6/4/5 | Not started | CR-01 §F. Tables generalized "seller"→"vendor" (role-agnostic) in CR-1B; provider UI + `service_prices` land Phase 4, planner reuse Phase 5 |
| REQ-VEND-05 | Multi-role capability (one user = seller AND provider) | P0 | 1.6 | Not started | CR-01 §C.1 (Q-C1). Capability derived from approved `vendor_applications` per role; `profiles.role`→primary/display; `middleware.ts`+`lib/rbac.ts` move from "role ==" to "has capability" (reconciles REQ-AUTH-03) |
| REQ-PAY-08 | Escrow hold/release (no payout before acceptance) | P0 | 2 | Not started | CR-01 §H. Funds `held` on capture/COD-collection → `available` on customer accept OR auto-release; nothing pays out before release. Extends `settle_status` |
| REQ-PAY-09 | Delivery-OTP hand-off confirmation (hashed, server-verified) | P0 | 2 | Not started | CR-01 §H. New `order_deliveries` (`otp_hash`, never plaintext); write service-role only. v1 admin enters OTP on courier's behalf (conflict `C9`, H-Q2 (a)) |
| REQ-PAY-10 | Configurable acceptance window (default 72h) + auto-release job | P0 | 2 | Not started | CR-01 §H. `platform_settings.acceptance_window_hours` (default 72, H-Q3); auto-release sweep (Supabase scheduled Edge fn / `pg_cron`) = assumed acceptance on expiry |
| REQ-PAY-11 | Disputes (freeze funds → admin resolve; release/refund only in v1) | P0 | 2 | Not started | CR-01 §H. New `disputes` + `dispute_status` enum; customer raises within window → funds held → admin resolves release|refund (partial deferred, H-Q4) |
| REQ-PAY-12 | Vendor settlement ledger & balances (held/available/paid + COD-commission netting) | P0 | 2 | Not started | CR-01 §H.1b. `settlements` ledger (`settlement_entry` enum: `sale_payable`/`cod_commission`) + `vendor_balances` view = single source of truth; `net_payable` = available − COD-commission debt |
| REQ-PAY-13 | Pluggable manual payout ("Mark as paid", `PayoutProvider`, `audit_log`) | P0 | 2 | Not started | CR-01 §H.1b/§H.8 (H-Q1). Admin-only audited disbursement; new `payouts` table + `payout_method` enum; `ManualPayoutProvider` now → `TapMarketplacePayoutProvider` later, no ledger-math change |

---

## Deferred items (with reason)

| REQ-ID | Reason |
|--------|--------|
| REQ-AI-01 | Needs accumulated user-interaction data; not on the 5-day critical path. |
| REQ-NOT-02 | Resend is email-only; SMS via Twilio is Phase 2 (C5). Provider-agnostic service built now. |
| REQ-NOT-03 | Scheduled SMS/email reminders depend on NOT-02 + edge cron; Phase 2. |
| REQ-SVC-06 | Center offers are P2; schema defined, UI deferred per cut-line (IMPLEMENTATION_PLAN). |
| REQ-DASH-06 | Basic reports in-scope; advanced reporting deferrable per cut-line. |

> **Never cut (P0):** all payment (PAY-*), RBAC (AUTH-*, NFR-03/05), availability/no-double-booking (RENT-02, SVC-05, BOOK-05), and the four core flows (buy/rent/book/quote).

---

## Conflict register (all resolved)

| C-ID | Summary | Resolution | Status |
|------|---------|-----------|--------|
| C1 | Prisma vs Supabase | Supabase migrations + generated types | ✅ |
| C2 | next-auth vs Supabase Auth | Supabase Auth (`@supabase/ssr`) | ✅ |
| C3 | Cloudinary vs Supabase Storage | Supabase Storage buckets | ✅ |
| C4 | JS/JSX vs TypeScript | TS; client code reference-only | ✅ |
| C5 | Resend (email) vs required SMS | Email now; SMS Phase 2 (Twilio) | ✅ |
| C6 | App-layer RBAC vs platform | RLS-first + app guards | ✅ |
| C7 | Upfront fee amounts inconsistent | `platform_upfront_fees` per type+currency | ✅ default |
| C8 | Booking fee vs security deposit | `upfront_fee` (non-refundable) + `security_deposit` (refundable) | ✅ default |
| C9 | "delivery agent" role absent (now needed for delivery-OTP) | **CR-01:** delivery-OTP hand-off (REQ-PAY-09) implies a courier. **v1 default (H-Q2 (a)): admin enters the OTP on the courier's behalf — no new role** (keeps the C9 v1 stance); `delivery_agent` role + courier view deferred until logistics is built | ✅ default (CR-01) |
| C10 | Currency (USD vs SAR/EGP) → market isolation | **CR-01:** hardened from "per-region currency on every monetary row" to **FULL market isolation** — per-market **visibility + shipping + COD + fulfillment** (EG/SA self-contained, no FX/cross-border); `market` enum distinct from `currency_code` (REQ-MKT-01..03) | ✅ default (CR-01) |

---

## Changelog
- 2026-06-28 — Initial matrix from all client messages + stack decisions.
- 2026-06-28 — Conflicts C7–C10 confirmed (defaults).
- 2026-06-28 — **Upgraded to REQ-ID|Description|Priority|Phase|Status|Notes format; aligned with rebuilt DATABASE.md (provider/profile_status/portfolio_items/is_paid/platform_upfront_fees); phases + deferrals made explicit.**
- 2026-06-28 — Phase 0 progress: Tasks 0.1–0.3 done & verified. REQ-AUTH-01..05 → In progress (0.3 DB foundation live: profiles, role/provider_type/profile_status enums, signup trigger, pending state, RLS enabled — smoke-test confirmed seller=pending/customer=active, relrowsecurity=true).
- 2026-06-28 — Task 0.4 done & verified (0002 pushed): profiles RLS policies + no-escalation column grants; platform_settings + platform_upfront_fees live, seeded, RLS authenticated-read/service-role-write. REQ-AUTH-06, REQ-PAY-06, REQ-NFR-05 → In progress.
- 2026-06-29 — Tasks 0.5 & 0.6 done & browser-verified. 0.5: next-intl `[locale]` shell (ar default, RTL, message catalogs, landing). 0.6: composed middleware (intl + Supabase session refresh + dashboard role guard from DB). REQ-NFR-01/03/07/08 → In progress; REQ-AUTH-02/06 progressed.
- 2026-06-29 — Task 0.7 implemented (sandbox gate passed: typecheck + lint clean, 10/10 unit tests). Auth routes `register`/`login`/`logout`/`me` (typed `{data}|{error:{code,message}}` envelope, server-side Zod), `features/auth` data layer (schema/queries/mutations/client), AuthCard + LoginForm + RegisterForm + RoleSelect, role-based redirect, minimal dashboard landings (customer/seller/provider/admin) with PendingApprovalBanner for pending sellers/providers (REQ-AUTH-05). All copy via `messages/*`; admin not self-registerable (schema rejects it). RLS smoke note at `tests/integration/auth.rls-smoke.md`. **Awaiting user browser verification** before marking 0.7 verified PASS. REQ-AUTH-01/02/05/06 progressed.
- 2026-06-29 — Playwright E2E set up (pulled forward from Phase 6, scoped to auth) so auth flows are verified by `pnpm test:e2e` instead of by hand. Added `@playwright/test`, `playwright.config.ts` (ar+en projects, baseURL :3000, auto `pnpm dev` webServer, traces/screenshots on failure), `tests/e2e/{fixtures.ts,auth.spec.ts,README.md}` + `data-testid`s on auth forms/banner/logout. 16 tests collected & compile (typecheck + lint + `playwright --list` green in sandbox). **0.7 stays "awaiting verification" until the user's `pnpm test:e2e` run is green.** REQ-NFR-10 → In progress.
- 2026-06-29 — **Task 0.7 VERIFIED PASS.** User ran `pnpm test:e2e` → **16/16 passed** (ar+en). Root cause of an initial failure was Supabase "Confirm email" being ON; user turned it OFF (⚠️ **must be re-enabled before production** — see prod caveat below) and ran the E2E teardown SQL. REQ-AUTH-01/02 → Done; REQ-AUTH-05/06 progressed; REQ-NFR-10 → In progress (auth E2E green).
- ⚠️ **PROD CAVEAT (Supabase Auth "Confirm email"):** turned OFF in dev so registration returns a session (E2E + smooth dev). **Re-enable before production** so emails are verified; when re-enabled the app already handles the no-session path (register → "check your email" → login). Tracked for the pre-launch checklist.
- 2026-06-29 — Task 0.8 done (sandbox gate: typecheck + lint clean, 17/17 unit). Provider abstractions: `lib/payments/{PaymentProvider,tap,stripe,index}.ts` (Tap primary; Stripe NotImplemented stub; factory) + `lib/notifications/{NotificationService,resend,sms,index}.ts` (Resend email channel; SMS interface placeholder for Phase 2). All secrets env + `server-only`; money in integer minor units; feature code depends on interfaces only. vitest `server-only` aliased to a stub so tests can import server-only modules. REQ-PAY-07 → Done; REQ-NOT-01 → In progress.
- 2026-06-29 — Task 0.10 (shared primitives) built; sandbox gate green (typecheck + lint + 24/24 unit). `components/shared/`: Navbar (server, fetches role) + NavbarClient (sticky, scroll-aware ivory blur, rose-gold active underline, real `public/logo.svg`, search/cart-badge/locale/auth menu), MobileNav (Sheet drawer, RTL start-side), AuthMenu (role-aware: login/register vs dashboard/logout), LocaleSwitcher (ar↔en preserving path), Footer (rich 4-zone warm peach-soft), RoleGuard (defense-in-depth), EmptyState + LoadingState. Wired via new `(marketing)/layout.tsx`; landing hero refined (premium). New messages (nav/common/footer/home extras). **Awaiting user FEEL review** (premium/spacious/distinctive) before 0.10 PASS. REQ-NFR-03/08 progressed.
- 2026-06-30 — **Phase 1 · Task 1.8 — Phase 1 DoD gate (prepared; awaiting user's E2E + Vercel preview).** Extended Playwright E2E with `tests/e2e/catalog.spec.ts`: **public** browse/render/RTL + filter+sort→URL + detail click-through + no-console-errors (always-on, empty-catalog-safe, ar+en) and an **opt-in seller** add-product-with-image flow (`E2E_SELLER=1` + service-role-seeded active seller via `tests/e2e/seller.ts`; real Storage upload; auto teardown). Added stable `data-testid`s to FilterBar/ProductCard/ProductForm/ImageUploader/ProductManager. RLS owner-only integration test `tests/integration/products-rls.test.ts` (opt-in) + SQL-editor smoke `tests/integration/products.rls-smoke.md`. Deleted the throwaway `app/[locale]/dev/upload-test/` harness. Migrations 0001–0003 + `supabase/storage/products_bucket.sql` (dashboard-run) are the catalog schema; `lib/database.types.ts` includes `categories`/`products`/`product_variants`. Gate: **typecheck + lint clean; 26 E2E compile (13×2); vitest 29 passed / 19 skipped.** **REQ-PROD-01..06 → Built** (live verification = the user's `pnpm test:e2e` + preview); REQ-NFR-12 Built; REQ-NFR-04 In progress (catalog caching/CLS + no-console E2E). **REQ-DASH-05 admin CategoryManager UI explicitly deferred → admin phase** (categories API built; consumed read-only by FilterBar/ProductForm in Phase 1). No production; preview only.
- 2026-06-30 — **Phase 1 · Task 1.7 done (sandbox gate green; awaiting browser verify).** Seller product CRUD. `features/catalog/schema.ts productSchema` (number-based — RHF + JSON API both send real numbers; seller-settable statuses only, `rejected` is admin-set; `.refine` rentable→daily-price) + `mutations.ts` (`createProduct`/`updateProduct`/`deleteProduct` via cookie server client; **`seller_id` taken from the session, never the request body**; ownership re-check select→404/403 layered **on top of** RLS; variant full-replace delete+insert; `revalidateTag('products')` + `product:{id}`) · `POST /api/products` (seller-role **+ active** gate — pending sellers blocked, REQ-AUTH-05) + `PUT/DELETE /api/products/:id` (owner gate) · `getMyProducts()` (session client, `*, product_variants(*)` → `SellerProduct[]`, not cached) · `ProductManager` (DataTable + edit Sheet + delete ConfirmDialog) + `ProductForm` (RHF/zodResolver, ImageUploader `products` bucket, variants `useFieldArray`); seller dashboard renders ProductManager only when `role==='seller' && status==='active'`, else PendingApprovalBanner. zodResolver input/output divergence (schema `.default()`/`.refine()`) resolved via `as Resolver<ProductInput>` (no `any`). RLS isolation test stub `tests/integration/products-rls.test.ts` (opt-in `RLS_TEST=1`; 10 tests: anon insert denied, `seller_id` spoof denied, draft invisible to anon + other seller, B can't update/delete A's row, A full CRUD). Gate: typecheck + lint clean; vitest **29 passed / 19 skipped** (both live suites skip without `RLS_TEST=1`). REQ-PROD-04/05 → In progress (implemented); REQ-PROD-06 wired into ProductForm. **Browser verify + live `products-rls` run = 1.8.**
- 2026-06-30 — **Phase 1 · Task 1.6 done (sandbox gate green; awaiting browser/E2E verify).** Public browsing: `features/catalog/{schema(ProductFilters),queries(listProducts/getProductById),images}` (cached, tags `products`/`product:{id}`, cookie-less public client) · `GET /api/products` (filters/sort/pagination, 400) + `GET /api/products/:id` (404 when !active) · `/products` (RSC, FilterBar+ProductGrid+ProductCard+Pagination, Suspense skeleton, EmptyState) + `/products/[id]` (ProductGallery, VariantSelector, serif PriceTag, generateMetadata+OG) — placed in `(marketing)` group for the Navbar/Footer shell; category filter uses category_id (slug-pretty URLs = future). next/image zero-CLS; RSC reads. REQ-PROD-01/02/03 → In progress (implemented); REQ-NFR-04 → In progress. typecheck + lint + 29/29 unit.
- 2026-06-30 — **Phase 1 · Tasks 1.3, 1.4, 1.5 done (sandbox gate green).** 1.3 reuse primitives: `lib/money.ts` (+ 5 unit tests) · `Money`/`PriceTag`/`StatusBadge`/`Pagination`/`ProductCardSkeleton`. 1.4: `useFilters` (URL state, 300ms-debounced price, page-reset) · `FilterBar` (Sheet on mobile) · generic `DataTable<T>` (Stripe-style, loading/empty/pagination). 1.5: `getCategories` (cached `unstable_cache` tag `categories`, cookie-less public client) + `GET/PUT /api/admin/categories` (admin-gated server-side; PUT service-role upsert + `revalidateTag`). Admin CategoryManager UI deferred → admin phase. typecheck + lint clean; 29/29 unit. REQ-PROD-02 (filter primitives), REQ-DASH-05 (categories API) progressed; REQ-NFR-04/10 supported.
- 2026-06-30 — **Phase 1 · Task 1.2 verified PASS (live).** Storage upload: `products` bucket (public) + 4 Storage RLS policies applied via dashboard (`supabase/storage/products_bucket.sql`, kept out of the migration chain — `storage.objects` ownership). `lib/constants.ts` (`PRODUCT_IMAGE_LIMITS` single source), `lib/storage/buckets.ts`, `POST /api/upload` (user-session client → RLS-enforced, no service-role), `useUpload`, reusable `ImageUploader`. **Verified live:** 6 images under `products/{uid}/…` (ownership enforced), public URLs render, `{url,alt,sort}` matches `products.images`; guards BAD_FILE/TOO_LARGE/401; E2E still 16/16. Temp dev harness at `app/[locale]/dev/upload-test` (404 in prod; **delete before Phase 1 closes**). REQ-NFR-12 → Built; REQ-PROD-06 → In progress.
- 2026-06-30 — **Phase 1 · Task 1.1 done & applied.** `supabase/migrations/0003_catalog.sql` pushed to the live DB (clean; idempotent `drop…if exists` NOTICEs expected on first run) + `pnpm db:types` regenerated (`categories`/`products`/`product_variants` + `listing_status` enum present, columns match DATABASE.md §3.2–3.4); typecheck clean. RLS: categories public-read/service-role-write; products public-read-`active`/owner-CRUD; variants public-read-where-parent-active/owner-via-join — anon writes revoked. Indexes cover every FK + filter/sort column. 5 product categories seeded. REQ-PROD-01/02/04/05 → In progress; REQ-DASH-05 → In progress.
- 2026-06-30 — ✅ **PHASE 0 COMPLETE — gate PASSED (live).** User verified: typecheck + lint clean, E2E **16/16**, RLS smoke (own-row read only · settings/fees readable · role+status escalation DENIED · full_name allowed), and a **green deploy at `princess-woad.vercel.app`** (7/7 acceptance checks). Final reconciliation: **Built** = REQ-AUTH-01..06, REQ-NFR-01/02/03/05/07/08/10/**11**, REQ-PAY-06, REQ-PAY-07; **Deferred (foundation built, scheduled — not cut)** = REQ-PAY-01 → Phase 2, REQ-NOT-01 → Phase 5. ⚠️ Deploy shipped to **Production from `main` with sandbox/placeholder keys** (no real payments/emails) — real launch = Phase 7 (live Tap/Marketplace + KYC + legal entity, replace `TAP_WEBHOOK_SECRET` + `RESEND_API_KEY` placeholders, re-enable Confirm email). Commit + tag `phase-0` handled by the user. `docs/PHASE_0_ACCEPTANCE.md` finalized.
- 2026-06-29 — **Task 0.11 — Phase 0 DoD gate (prepared; awaiting Vercel preview).** Gates green: typecheck + lint clean; **24 unit + 9 RLS (opt-in)**; auth E2E 16/16 (user-run). Added `tests/integration/rls.test.ts` (opt-in `RLS_TEST=1`) + SQL-editor RLS block. Phase-0 REQ-IDs set to **Built**: REQ-AUTH-01..06, REQ-NFR-01/02/03/05/07/08/10. Multi-phase reqs kept **In progress + carry-forward** (not "Built"=overclaim, not "Deferred"=implies cut): REQ-PAY-01 (Tap intent → Phase 2), REQ-PAY-06 (admin settings UI → Phase 2), REQ-NOT-01 (email triggers/templates → Phase 5); REQ-NFR-11 deployment In progress (preview). `docs/PHASE_0_ACCEPTANCE.md` produced. **No commit until user confirms preview is green** (then commit+tag the phase). Carry-forwards: Tap webhook-secret confirmation (Phase 2), `/payment/callback` (Phase 2), dark mode + `logo-reversed.svg` (Phase 2), SMS/Twilio (Phase 2), sitemap/hreflang/OG (Phase 6/7).
- 2026-06-29 — **Task 0.9 (Tap sandbox spike) VERIFIED PASS.** User ran `pnpm spike:tap` against live Tap sandbox → charge `chg_TS05A…`, `live_mode:false`, `status:INITIATED`, `transaction.url` returned. Caveat (b) decimals CONFIRMED (sent 1 SAR, echoed amount=1/SAR; SAR/EGP=2dp). Caveat (a): API auth = `TAP_SECRET_KEY` CONFIRMED; webhook hashstring secret DEFERRED to Phase 2 (needs delivered webhook via public post.url; keep account-secret assumption in tap.ts). Findings recorded in `docs/SPIKE_NOTES.md`: (1) shared sandbox merchant 599424 reports KWD — not ours, real merchant/currency comes with our keys; (2) Phase 2 must build `/payment/callback` (redirect.url) + ensure webhook handler at `/api/payments/webhook` (post.url). REQ-PAY-01 progressed.
- 2026-06-29 — Task 0.9 (Tap sandbox spike) built; sandbox gate green (typecheck + lint + 24/24 unit). `TapProvider.createIntent` now makes the real Tap `/v2/charges` call (minor→major via exported `toTapAmount`; raw response on `PaymentIntent.raw`); `scripts/tap-spike.ts` + `scripts/tsconfig.json` (server-only stub alias) + `pnpm spike:tap` run it; offline createIntent unit tests now mock `fetch`. Caveat (b) closed by unit test (SAR/EGP = 2 decimals). Caveat (a): API auth = `TAP_SECRET_KEY` (a dummy key reached Tap → `401 code 2104`, so HTTPS to Tap IS reachable from this env — premise corrected; structurally confirmed); webhook hashstring secret needs a delivered webhook to confirm (docs/SPIKE_NOTES.md). **Awaiting user's keyed `pnpm spike:tap` run** to record the live charge response + close caveat (a). Not Done until then.
- 2026-06-29 — **Task 0.8 VERIFIED PASS** + two marketplace refinements (user review): (1) `CreateIntentInput.destination?: PaymentDestination` added as an **optional** field (own type) so the Tap split-settlement path (REQ-PAY-05) is additive later with no caller breakage — single-merchant now, split = Phase 2; (2) `TapProvider.verifyWebhook` restructured from generic whole-body HMAC to **Tap's `hashstring` scheme** (canonical field string in fixed order → HMAC-SHA256 → timing-safe compare, fail-closed; exported `buildTapHashString`). Two caveats deferred to the 0.9 live spike (well-isolated): which secret keys the hashstring (used `TAP_WEBHOOK_SECRET`), and per-currency amount decimals. Now 21/21 unit (added destination + webhook round-trip/tamper/missing-hash tests).

---

## Changelog — CR-01 reconciliation (2026-07-01)

**Source:** `docs/CHANGE_REQUEST_01.md` (APPROVED v2 — all decisions + recommended defaults for remaining escrow questions accepted). Doc-only reconciliation of the matrix; **no schema/code written.** Work packages: **CR-1A** (Phase 1.5 — markets/pricing/attributes), **CR-1B** (Phase 1.6 — onboarding/KYC/multi-role), **CR-2** (folded into Phase 2 — escrow/OTP/disputes/payouts).

**New section added — `M. Markets & Vendor Verification` (17 new REQ-IDs, all Status = Not started):**
- Markets: **REQ-MKT-01** (P0/1.5, isolation), **REQ-MKT-02** (P0/1.5, resolution), **REQ-MKT-03** (P0/1.5, market-filtered visibility).
- Products: **REQ-PROD-07** (P0/1.5, multi-market pricing + per-market stock), **REQ-PROD-08** (P0/1.5, seller market declaration + local-presence), **REQ-PROD-09** (**P1**/1.5, filterable attributes — **promoted P2→P1** per Q-G1).
- Vendors: **REQ-VEND-01** (P0/1.6, onboarding application), **REQ-VEND-02** (P0/1.6, KYC), **REQ-VEND-03** (P1/1.5+5, public vendor info/badge), **REQ-VEND-04** (P0/1.6+4+5, providers+planners), **REQ-VEND-05** (P0/1.6, multi-role capability, Q-C1).
- Payments/escrow: **REQ-PAY-08** (P0/2, escrow hold/release), **REQ-PAY-09** (P0/2, delivery-OTP), **REQ-PAY-10** (P0/2, acceptance window default 72h + auto-release), **REQ-PAY-11** (P0/2, disputes), **REQ-PAY-12** (P0/2, settlement ledger & balances + netting), **REQ-PAY-13** (P0/2, pluggable manual payout).

**Rows modified (status change → shown as old→new; others note-only, no status change):**
- **REQ-PROD-01/02/03/05/06** — Built → **In progress (CR-1A re-work)** (market-aware; price/currency/stock → `product_prices`/`product_variant_stock`; PROD-02 gains attribute facets; PROD-03 gains seller block).
- **REQ-AUTH-05** — Built → **In progress (extended by CR-01)** (approval now requires `vendor_applications` + KYC basis).
- **REQ-AUTH-03** (note: role → primary/display + derived capabilities, Q-C1), **REQ-AUTH-04** (note: `provider_type` via application) — Status Built kept, reconciliation notes added.
- **REQ-SVC-04** (multi-market via `service_prices`, Phase 4), **REQ-EVT-07** (planner verify → unified KYC; `event_planners.is_verified` removed, Q-F1), **REQ-PAY-03** (COD → delivery-OTP), **REQ-PAY-04** (buyer-`is_paid` vs vendor-`available`/`paid`), **REQ-PAY-05** (payout only from `available`, netted, manual), **REQ-ORD-04** (lifecycle adds delivered→accepted/auto-released), **REQ-DASH-04** (admin gains applications/KYC/disputes/payouts panels) — note-only (already Not started).
- **REQ-PAY-06** (add `acceptance_window_hours` setting), **REQ-DASH-05** (extend admin to manage attribute definitions/options), **REQ-NFR-11** (KYC pulled earlier than Phase 7 + legal/compliance flag: platform holding third-party funds in EG/SA may carry regulatory implications — client to verify, ref CR-01 §H.8.1) — note-only (Status kept).

**Conflict register updated (format preserved):**
- **C10** — hardened from "per-region currency on every monetary row" to **FULL market isolation** (visibility + shipping + COD + fulfillment; EG/SA self-contained, no FX).
- **C9** — delivery agent now needed for the delivery-OTP; **v1 default = admin enters OTP on the courier's behalf, no new role** (H-Q2 (a)); `delivery_agent` deferred to logistics build.
