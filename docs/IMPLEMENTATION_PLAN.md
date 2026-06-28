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

## PHASE 2 — Cart, Orders, Hybrid Payments & COD (Day 2 second half → Day 3)

**Objectives:** The commercial core — cart → checkout → upfront fee (Tap) → COD → settlement. **Highest priority.**
**Deliverables:** End-to-end purchase with hybrid payment + COD confirmation + commission settlement.
**Database:** `cart_items`, `orders`, `order_items`, `payments` (idempotency), `settlements`, RLS.
**Backend:** cart routes, `/api/orders`, `/api/payments/create-intent`, `/api/payments/webhook` (signed+idempotent), `/api/payments/confirm-cod`, settlement logic, `lib/money.ts`.
**Frontend:** cart page, checkout (AddressForm, PaymentSummary, **CODBreakdown**, PayButton), order confirmation, customer OrdersPanel, admin CODConfirmPanel + SettingsPanel (commission/fees).
**Components:** CartItemRow, CartSummary, PaymentSummary, CODBreakdown, CODConfirmDialog, SettingsForm.
**Pages:** `/cart`, `/checkout`, `/dashboard/admin` (settings+COD).
**APIs:** cart, orders, payments(3), admin/settings.
**Testing:** ✦ COD rule — order `paid` only when upfront captured AND COD confirmed (REQ-PAY-04); webhook idempotency/signature; commission math; cod_amount display (REQ-ORD-03).
**Est. hours:** 10 (buffer — most critical).
**Acceptance:** Buy a product end-to-end; exact COD shown; admin confirms cash; settlement deducts configured commission.
**DoD:** Payment webhook replay-safe; money math integer-correct; audit_log written.
**Git commit:** `feat(commerce): cart, checkout, hybrid payments (tap), cod, settlements`

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
`Phase0 → Phase1 → Phase2 (payments core) → {Phase3 rentals, Phase4 services} → Phase5 → Phase6 → Phase7`
Phases 3 and 4 both depend on Phase 2's payment + Phase 0's auth; they share `AvailabilityCalendar` (build in 3, reuse in 4).
