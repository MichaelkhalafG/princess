# IMPLEMENTATION_PLAN.md

> **Project:** Princess · **5 development days + 2 testing days.**
> Scope: full feature set (client confirmed "everything in 5 days, full speed").
> ⚠️ **Honest risk note:** This is an aggressive timeline for a 3-in-1 marketplace with hybrid payments, RBAC, RTL, and 4 dashboards. The plan front-loads money/integrity-critical paths (payments, COD rule, availability) and sequences features so that if a day slips, the **cut line** falls on lower-priority items (center offers, AI, advanced reports) — never on P0 payment/RBAC correctness. Any cut is recorded in `REQUIREMENTS_MATRIX.md`, never silent.

Phase = one development day (~8h). Each phase must reach **Definition of Done** before the next begins (per client instruction).

---

## PHASE 0 — Foundation & Spike (Day 1, first half)

**Objectives:** Project skeleton, Supabase wired, auth + RBAC + RTL working, Tap sandbox spike.
**Deliverables:** Running Next.js 14 TS app on Vercel preview; Supabase project; login/register; locale routing; Tap sandbox proof.
**Database:** extensions, enums, `profiles` (+ signup trigger), RLS baseline, `platform_settings` seed.
**Backend:** `lib/supabase/*`, `middleware.ts` (auth+locale+RBAC), auth routes, `PaymentProvider` interface + Tap stub, `NotificationService` + Resend.
**Frontend:** `app/[locale]` shell, `<html dir lang>`, shadcn install, Navbar/Footer, LoginForm/RegisterForm, theme tokens (peach/rose-gold/white).
**Components:** ui primitives, AuthShell, RoleGuard, LocaleSwitcher.
**Pages:** marketing landing, login, register.
**APIs:** `/api/auth/*`.
**Testing:** auth unit + RLS smoke; Tap sandbox create-intent call succeeds.
**Dependencies:** Supabase keys, Tap sandbox keys, Resend key.
**Est. hours:** 8.
**Acceptance:** A user can register/login; role redirect works; AR RTL renders; Tap sandbox returns a token.
**DoD:** Deploys green to Vercel; typecheck+lint pass; RLS deny-by-default verified.
**Git commit:** `chore(foundation): scaffold next14+supabase, auth, rbac, i18n, tap spike`

---

## PHASE 1 — Catalog & Storage (Day 1 second half → Day 2)

**Objectives:** Products + categories + variants + image storage + public browsing + seller CRUD.
**Deliverables:** Browseable catalog, seller product management.
**Database:** `categories`, `products`, `product_variants`, indexes, RLS (public read active / owner CRUD), `products` bucket.
**Backend:** `/api/products` (CRUD), `/api/upload` (Supabase Storage), `/api/admin/categories`.
**Frontend:** products list (FilterBar, ProductGrid, Pagination), product detail (Gallery, VariantSelector), seller ProductManager (DataTable + ProductForm + ImageUploader).
**Components:** ProductCard, FilterBar, ProductGallery, DataTable, ImageUploader, PriceTag/Money.
**Pages:** `/products`, `/products/[id]`, `/dashboard/seller`.
**APIs:** products, upload, categories.
**Testing:** product CRUD integration; RLS (seller sees only own); filter/sort.
**Est. hours:** 8.
**Acceptance:** Seller adds product w/ images; public sees active products; filters work.
**DoD:** RLS verified; images persist; reuse-first (Money, DataTable).
**Git commit:** `feat(catalog): products, variants, categories, storage, seller crud`

---

## PHASE 1.5 — Markets, Multi-Market Pricing & Filterable Attributes (CR-01, inserted before Phase 2)

**Objectives:** Turn the single-price catalog into independent `EG`/`SA` markets with per-market pricing/stock, add market resolution + switching, and add **color + size** controlled-vocabulary filterable attributes (facets with counts).
**Deliverables:** A market-scoped, faceted catalog; sellers price per approved market; a first-visit MarketChooser + MarketSwitcher; minimal seller block on product detail.
**Database (`0008_markets_pricing.sql`):** new enum `market` + `attribute_input`; new `product_prices`, `product_variant_stock`, `vendor_markets`, `attribute_definitions`, `attribute_options`, `product_attributes`; `public_vendor_profiles` view (minimal seller block); RLS for all. ⚠ **Closed-phase alters:** `products` (`0003`) DROP price/currency/rental_daily_price/security_deposit/stock; `product_variants` (`0003`) DROP `stock`; `profiles` (`0001`) ADD `market` (+ optional `country`).
**Backend:** `lib/markets.ts` (EG→EGP/SA→SAR map); market resolution in `middleware.ts` (cookie→`profiles.market`→chooser, geo = hint only); **centralized cross-market filter in `features/catalog/queries.ts`** (NOT RLS); `GET/POST /api/market`; `POST/PUT /api/products` carry `prices[]` + `attribute_option_ids[]`; `GET/POST /api/vendor/markets`; admin `GET/PUT /api/admin/attributes`; catalog query/filters extended with attribute facets.
**Frontend:** MarketChooser gate + MarketSwitcher (sibling to LocaleSwitcher); `ProductForm` two-price sets (EGP+SAR) when covering both markets; `FilterBar` sidebar gains **Color + Size facet sections** (with counts) alongside category/price/rentable; `SellerInfoCard` (name + market chips) on product detail; market-aware `ProductCard`/`PriceTag`.
**Components:** MarketChooser, MarketSwitcher, Color/Size FacetSections, SellerInfoCard (minimal).
**CR-1A explicitly deferred (placeholders only — do NOT build here; recorded so design matches backend):** **wishlist heart** (UI-only placeholder → new favorites feature, later phase), **reviews/ratings** — the rating filter + card stars render as non-functional placeholders (→ **Phase 5**), the **verified badge** reflects `is_verified` but stays a placeholder until **Phase 1.6** KYC flips it, and **brand** is NOT added as a column (model it as a product attribute later if needed).
**Pages:** `/products`, `/products/[id]` (re-worked for market + facets + seller block), `/dashboard/seller` (market declaration + per-market pricing).
**APIs:** market, products (re-work), vendor/markets, admin/attributes.
**Testing:** **market-isolation integration test** (EG never sees SA-only products & vice-versa — guards the query-layer filter); market-aware catalog E2E + facet filters; per-market stock resolution.
**Seed:** regenerate `scripts/seed-dummy.ts` to the new shape — pricing → `product_prices`, stock → `product_variant_stock`, plus `vendor_markets` + `product_attributes`; seed must span **both** markets (`pnpm seed:reset`).
**Est. hours:** ~6–8 (≈1 day). ⚠ Larger than a v1 jsonb attribute idea (3 tables + admin vocabulary).
**Environment split:** Claude writes migration `0008` + query/filter/form/seed rework as **proposals**; **user runs** `supabase db push`, `pnpm db:types`, `pnpm dev`, `pnpm test:e2e`.
**Acceptance:** A visitor picks a market (geo pre-highlighted, not forced), sees only that market's products in its currency, and filters by facets; a both-market seller enters two prices.
**DoD:** Market isolation proven by test (no cross-market leak); facets query correctly; catalog E2E re-gated market-aware; seed spans EG+SA.
**Git commit:** `feat(markets): market resolution, multi-market pricing, per-market stock, filterable attributes`

---

## PHASE 1.6 — Vendor Onboarding & Verification (KYC) (CR-01, before Phase 2)

**Objectives:** Real vendor onboarding (application + sample images) + KYC identity verification (private docs) + admin review, and the **multi-role capability rewrite** (a user can be BOTH seller and provider).
**Deliverables:** Seller applies with business data + sample images + KYC docs → admin reviews → approve/reject; verification badge; capability-based authorization.
**Database (`0009_vendor_verification.sql`):** new enum `verification_status`; new `vendor_applications` (**`unique(applicant_id, role)`** — multi-role, Q-C1) + `vendor_verification`; first **private `verification-docs` bucket** (`public:false`) + storage RLS; RLS for all. ⚠ **Closed-phase alter:** `profiles` (`0001`) ADD `is_verified`; `role` becomes primary/display (capability derived from approved applications).
**Backend:** multi-role **capability rewrite** in `middleware.ts` + `lib/rbac.ts` (from "role ==" to "has capability"); `POST /api/vendor/applications` + `GET …/me`, admin `GET/PUT /api/admin/applications*`; `POST /api/vendor/verification` + `GET …/me`, admin `GET/PUT /api/admin/verifications*` (on approve → `profiles.is_verified=true` + approve `vendor_markets`); `POST /api/upload` private path (returns storage path, signed URLs for admin).
**Frontend:** seller onboarding application form (data + sample images + KYC upload); admin ApprovalsPanel + VerificationPanel (signed-URL doc view). Provider/planner UI **reuse rides Phase 4/5** (schema is role-agnostic now).
**Components:** VendorApplicationForm, VerificationPanel, private ImageUploader path.
**Pages:** `/dashboard/seller` (application/KYC), `/dashboard/admin` (applications + verifications).
**APIs:** vendor/applications, vendor/verification, admin/applications, admin/verifications, upload (private).
**Testing:** capability RLS/guard tests (both-role user reaches both dashboards; no privilege escalation on `status`/`is_verified`); private-bucket access (owner write/read own, no public read, admin signed URL).
**Est. hours:** ~6 (≈0.5–1 day).
**Environment split:** Claude writes migration `0009` + auth/rbac rewrite + endpoints as **proposals**; **user runs** `supabase db push`, `pnpm db:types`, `pnpm dev`, `pnpm test:e2e`.
**Acceptance:** A user applies as seller (and separately as provider) with docs; admin approves; badge shows; the both-role user reaches both dashboards.
**DoD:** Capability model verified (no `profiles.role ==` gate remains); private bucket leaks nothing publicly; approval sets `is_verified` + markets.
**Git commit:** `feat(vendors): onboarding application, KYC verification, private bucket, multi-role capability`

---

## PHASE 2 — Cart, Orders, Hybrid Payments, COD & Escrow (Day 2 second half → Day 3)

**Objectives:** The commercial core — cart → checkout → upfront fee (Tap) → COD → **escrow hold → delivery-OTP → acceptance/auto-release → settlement ledger → manual payout**. **Highest priority.** Escrow (CR-01 §H) IS the settlement design and is built **with** Phase 2, not bolted on after.
**Deliverables:** End-to-end purchase with hybrid payment + COD confirmation; funds **held** until acceptance or auto-release; disputes freeze funds; per-vendor settlement ledger + admin manual "Mark as paid".
**Database:** `cart_items`, `orders`, `order_items`, `payments` (idempotency), `settlements`, RLS. **Escrow extensions (extend `0004_commerce.sql` or a paired `0004b_escrow.sql`):** new `order_deliveries` (hashed delivery OTP), `disputes`, `payouts`; new enums `dispute_status`, `settlement_entry` (`sale_payable`/`cod_commission`), `payout_method` (`manual_bank_transfer`/`tap_marketplace`); **extend `settle_status`** → `('held','available','paid','refunded','disputed','cancelled')` (`pending` retired); `settlements` ledger extensions (`entry_type`/`market`/`held_at`/`available_at`/`available_reason`/`dispute_id`/`payout_id`); `orders` ADD `delivered_at`/`accepted_at`/`auto_release_at`; `platform_settings` ADD `acceptance_window_hours` (default 72); **`vendor_balances` view** (held/available/paid + COD-commission netting).
**Backend:** cart routes, `/api/orders`, `/api/payments/create-intent`, `/api/payments/webhook` (signed+idempotent), settlement logic, `lib/money.ts`. **Escrow:** `POST /api/orders/:id/confirm-delivery` (OTP verify → `delivered`, COD collected, settlement `held`, start window — supersedes/merges `confirm-cod`), `POST /api/orders/:id/accept` (`held→available`), `POST /api/disputes` + `GET /api/disputes/:id` + admin `GET/PUT /api/admin/disputes*` (release/refund, Tap refund for online), **auto-release scheduled job** (Supabase Edge Function / `pg_cron`), `GET /api/admin/payouts` (vendors + system-computed NET payable) + `POST /api/admin/payouts` ("Mark as paid" → `available→paid`, clear netted COD debt, `audit_log`); **`lib/payouts/{PayoutProvider,manual,tapMarketplace,index}.ts`** (ManualPayoutProvider now).
**Frontend:** cart page, checkout (AddressForm, PaymentSummary, **CODBreakdown**, PayButton), order confirmation, customer OrdersPanel (+ "Confirm receipt" / "Open dispute" on delivered orders), admin CODConfirmPanel + SettingsPanel (commission/fees/acceptance-window) + **DisputesPanel** + **PayoutsPanel** (the manual "Mark as paid" dashboard, replacing per-settlement pay).
**Components:** CartItemRow, CartSummary, PaymentSummary, CODBreakdown, CODConfirmDialog, SettingsForm, DisputeForm, PayoutsPanel, DeliveryOTPForm.
**Pages:** `/cart`, `/checkout`, `/dashboard/admin` (settings+COD+disputes+payouts).
**APIs:** cart, orders(+confirm-delivery/accept), payments, disputes, admin/settings, admin/disputes, admin/payouts.
**Testing:** ✦ COD rule — buyer-`is_paid` (entry to `held`) vs vendor `available`/`paid` (two distinct axes, REQ-PAY-04); webhook idempotency/signature; commission math; cod_amount display (REQ-ORD-03); **hold→available→paid lifecycle**; **netting math** (online `available` credit vs COD-commission debt, incl. negative `net_payable`); delivery-OTP hash/verify; auto-release timing; dispute freeze; **manual-payout audit trail**.
**Est. hours:** 10 (buffer — most critical; escrow compounds this phase, but H-Q1's manual pluggable payout **de-risks** the launch by removing the Tap Marketplace dependency).
**Acceptance:** Buy a product end-to-end; exact COD shown; delivery confirmed via OTP; funds held then released on accept or auto-release; a dispute freezes funds for admin; admin sees computed NET and marks a vendor paid (audited).
**DoD:** Payment webhook replay-safe; money math integer-correct; ledger (`settlements`+`vendor_balances`) is the single source of truth; auto-release job runs; every payout is admin-only + `audit_log` written.
**Note:** H-Q1 resolved (system-of-record escrow + **manual pluggable payout**) → Tap Marketplace is a **later automation** (provider swap), NOT a launch gate. Tap **refunds** (online dispute resolution) remain Phase-2 scope. ⚖ Raise the §H.8 legal/compliance point (platform holding third-party funds in EG/SA) with the client early.
**Git commit:** `feat(commerce): cart, checkout, hybrid payments (tap), cod, escrow ledger, disputes, manual payouts`

---

## PHASE 3 — Rentals & Availability (Day 3 second half)

**Objectives:** Date-range rentals with no double-booking + deposit/fee.
**Deliverables:** Rent a dress for a range; conflicts blocked at DB level.
**Database:** `rentals` (+ `btree_gist` exclusion constraint), RLS.
**Backend:** `/api/rentals`, `/api/rentals/availability/:productId`, `/api/rentals/:id/status` (transactional create → 409 on overlap).
**Frontend:** rentals list, rental detail (DateRangePicker, AvailabilityCalendar, RentSummary), customer RentalsPanel.
**Components:** RentalCard, DateRangePicker, AvailabilityCalendar (reused later by services).
**Pages:** `/rentals`, `/rentals/[id]`.
**APIs:** rentals(3).
**Testing:** ✦ overlap rejection under concurrency; deposit+fee in checkout; status machine.
**Est. hours:** 6.
**Acceptance:** Rent for June 1–5; same item unbookable those dates.
**DoD:** Exclusion constraint proven via concurrent test.
**Git commit:** `feat(rentals): date-range rentals with availability constraints + deposit`

---

## PHASE 4 — Services, Availability Slots & Bookings (Day 4)

**Objectives:** Service catalog, slot availability, bookings with upfront fee + realtime slot blocking.
**Deliverables:** Book a service; slot reserved + blocked live.
**Database:** `services`, `availability` (exclusion constraint), `bookings`, `center_offers`, RLS, `services` bucket.
**Backend:** services CRUD, `/api/availability/*`, bookings(4), center-offers, Realtime channel; booking confirmed on capture.
**Frontend:** services list/detail (SlotPicker, AvailabilityCalendar reused), BookingConfirmDialog, provider ServiceManager + BookingManager, customer BookingsPanel, OffersManager.
**Components:** ServiceCard, ServiceFilterBar, SlotPicker, BookingCard, BookingStatusControl, OfferCard.
**Pages:** `/services`, `/services/[id]`, provider dashboard sections.
**APIs:** services, availability, bookings, center-offers.
**Testing:** ✦ slot double-book prevention + realtime blocking; booking confirmed only after fee; status machine.
**Est. hours:** 9.
**Acceptance:** Book a makeup slot; slot disappears for others live; remaining-cash shown.
**DoD:** Realtime verified; transactional reservation; RLS scoped.
**CR-01 note:** services go **multi-market** — add a **`service_prices`** child table `(service_id, market, currency, price, is_available)` mirroring `product_prices` (Phase 1.5); slot/availability stays market-agnostic. Provider onboarding/KYC/markets **reuse** the role-agnostic `vendor_applications`/`vendor_verification`/`vendor_markets` from Phase 1.6 (REQ-VEND-04) — this phase adds the provider-facing UI, not new tables.
**Git commit:** `feat(services): catalog, availability slots, bookings, realtime blocking, offers`

---

## PHASE 5 — Event Planners, Portfolio, Reviews, Dashboards, Notifications (Day 5)

**Objectives:** Addendum features + reviews + complete dashboards + email notifications.
**Deliverables:** Planners browse/request/verify; portfolio everywhere; reviews; full admin/provider/customer dashboards; Resend emails.
**Database:** `event_planners`, `event_requests`, `portfolio_items`, `reviews` (+ rating triggers), `notifications`.
**Backend:** event-planners(+requests+verify), portfolio (provider/users/services), reviews, admin (approvals/reports/settlements), notification triggers (Resend).
**Frontend:** event-planners list/detail (QuoteRequestForm), provider profile page, PortfolioGallery + PortfolioManager, ReviewsSection/ReviewForm, customer/provider/admin dashboard completion (ApprovalsPanel, PlannerVerifyPanel, ReportsPanel, SettlementsPanel, EventRequestsPanel).
**Components:** PlannerCard, PackageCard, PortfolioGallery, PortfolioLightbox, ReviewsSection, RatingStars, approval/report panels.
**Pages:** `/event-planners`, `/event-planners/[id]`, `/providers/[id]`, dashboard completions.
**APIs:** event-planners(*), portfolio(3), reviews(2), admin(approvals/reports/settlements), upload(reuse).
**Testing:** request lifecycle; combined portfolio merge; review aggregation; admin verify; email send (sandbox).
**Est. hours:** 10.
**Acceptance:** Customer requests a planner; provider accepts; portfolio shows on profile+service; admin verifies; confirmation emails sent.
**DoD:** All P0/P1 matrix rows reach status built or explicitly deferred; RTL across all new pages.
**CR-01 note (Q-F1):** when `0007_planners_portfolio_reviews.sql` is authored, `event_planners` **omits `is_verified`** — the single source of truth becomes **`profiles.is_verified`** (set by the unified KYC review, Phase 1.6). The planner public-read gate joins `profiles.is_verified`; `PUT /api/event-planners/:id/verify` folds into `PUT /api/admin/verifications/:id`. Planner onboarding/KYC/markets reuse the role-agnostic vendor tables (REQ-VEND-04); the full `SellerInfoCard` (rating rollup) completes here as `reviews` lands.
**Git commit:** `feat(planners+portfolio): event planning, portfolio gallery, reviews, dashboards, email`

---

## PHASE 6 — Testing & Hardening (Day 6)

**Objectives:** Verify every flow; security; RTL/responsive/PWA; performance.
**Tasks:** E2E (Playwright) for buy/rent/book/quote; ✦ exhaustive COD + payment webhook tests; RLS policy tests per table; concurrency tests (rental/slot); RTL + mobile audit; a11y (WCAG AA) pass; SEO metadata/sitemap/hreflang; Lighthouse; PWA manifest.
**Acceptance:** All P0 flows pass E2E; no RLS leak; COD rule correct; mobile flawless.
**DoD:** Green CI; test report attached; matrix statuses updated.
**Git commit:** `test: e2e flows, rls policies, payment/cod, rtl, a11y, perf hardening`

---

## PHASE 7 — UAT, Fixes & Deploy (Day 7)

**Objectives:** Client UAT, bug fixes, production deploy.
**Tasks:** Seed demo data; UAT script per role; fix triage; prod env config; Supabase migrations to prod; Vercel production; runbook + handover docs.
**Acceptance:** Client signs off on core flows in production.
**DoD:** Production live; env secured; matrix fully reconciled (built/deferred); changelog updated.
**Git commit:** `chore(release): production deploy, seed, uat fixes, handover`

---

## Cross-phase tracking

- Every PR description lists the `REQ-IDs` it satisfies.
- Daily: update `Status` column in `REQUIREMENTS_MATRIX.md`.
- Deferred-by-default if time runs out (lowest priority first): `REQ-AI-01`, `REQ-NOT-02/03` (SMS already deferred), `REQ-SVC-06` center offers, advanced `REQ-DASH-06` reports. P0 payment/RBAC/availability never cut.

## Dependency graph (critical path)
`Phase0 → Phase1 → Phase1.5 (markets/pricing/attributes) → Phase1.6 (vendor onboarding/KYC/capability) → Phase2 (payments+escrow core) → {Phase3 rentals, Phase4 services} → Phase5 → Phase6 → Phase7`
Phases 3 and 4 both depend on Phase 2's payment + Phase 0's auth; they share `AvailabilityCalendar` (build in 3, reuse in 4).
**Hard dependency:** Phase 1.5's B (per-market price rows) precedes A's catalog market filter (one migration, `0008`). Phase 1.6 gates listing on approved applications/KYC.

## Timeline impact (CR-01)
CR-1A (Phase 1.5) + CR-1B (Phase 1.6) insert **~1–1.5 days between Phase 1 and Phase 2**. This is **formally inserted as Phases 1.5/1.6 rather than absorbed silently** (per CR-01 §7 R6) so the schedule and the cut-line stay honest. Escrow (§H) is absorbed into Phase 2's existing 10h buffer — H-Q1's manual pluggable payout de-risks it by removing the Tap Marketplace launch dependency.

## Environment split (applies to all new phases)
The existing split is explicit for Phases 1.5/1.6 and the expanded Phase 2: **Claude writes** the migrations (`0008`, `0009`, `0004`/`0004b`) + code/query/seed rework as **proposals**; **the user runs** `supabase db push`, `pnpm db:types`, `pnpm dev`, and `pnpm test:e2e`. Migrations are proposals the user applies — Claude never pushes to the database.

---

## Changelog — CR-01 reconciliation (2026-07-01)

- **Inserted Phase 1.5 — Markets, Multi-Market Pricing & Filterable Attributes** (`0008_markets_pricing.sql`): market enum + resolution middleware + MarketChooser/MarketSwitcher; `product_prices` + `product_variant_stock` + `vendor_markets`; `attribute_definitions/options/product_attributes` + facet filters; minimal seller block; seed regeneration; market-isolation integration test + market-aware catalog E2E. ⚠ closed-phase alters: `products`/`product_variants` (`0003`), `profiles` (`0001`).
- **Inserted Phase 1.6 — Vendor Onboarding & Verification (KYC)** (`0009_vendor_verification.sql`): `vendor_applications` (multi-role, Q-C1) + `vendor_verification` + private `verification-docs` bucket + admin review; `profiles.is_verified`; multi-role capability rewrite (middleware/rbac). Provider/planner UI rides Phase 4/5.
- **Expanded Phase 2** to include §H escrow: `order_deliveries`, `disputes`, `payouts`, `settlements` ledger extensions, `vendor_balances` view, `lib/payouts/*`, auto-release scheduled job; DoD expanded (hold→available→paid, netting math, delivery-OTP, auto-release timing, dispute freeze, manual-payout audit). Noted H-Q1 de-risks the Tap Marketplace launch dependency; Tap **refunds** remain Phase-2 scope.
- **Phase 4/5 notes:** `service_prices` (Phase 4); drop `event_planners.is_verified` → `profiles.is_verified` (Phase 5, Q-F1).
- **CR-1A scope refinement (2026-07-01):** launch attributes fixed to **color + size** (controlled vocabulary, no free text); Phase-1.5 facets = color/size/category/price/rentable with computable counts. **Explicit deferrals recorded (placeholders in CR-1A, not built):** wishlist heart (later favorites feature), reviews/ratings (Phase 5), verified badge (Phase 1.6 KYC), brand (no column — later attribute).
- **Dependency graph + timeline impact:** added Phases 1.5/1.6 to the critical path; documented the ~1–1.5-day insertion and the explicit environment split.
