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
| REQ-AUTH-01 | Register (email/password, role at signup) | P0 | 0 | In progress | 0.3: `profiles` + `handle_new_user` trigger live (role from signup metadata). Register API/form = Task 0.7 |
| REQ-AUTH-02 | Login + session via `@supabase/ssr` | P0 | 0 | In progress | 0.2: ssr clients built. Session middleware = 0.6; login route/form = 0.7 |
| REQ-AUTH-03 | Roles: customer/seller/provider/admin | P0 | 0 | In progress | 0.3: enum `user_role` (`provider`, not service_provider) + `profiles.role` live |
| REQ-AUTH-04 | Provider type freelancer/center | P1 | 0 | In progress | 0.3: `profiles.provider_type` enum/column live |
| REQ-AUTH-05 | Seller/provider admin approval before listing | P0 | 0 | In progress | 0.3: trigger sets non-customers to `pending` (verified live: seller=pending, customer=active). Admin approval UI later |
| REQ-AUTH-06 | RBAC middleware + RLS enforcement | P0 | 0 | Not started | RLS-first + middleware + RoleGuard (0.4 policies / 0.6 middleware) |

## B. Products (Buy)

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-PROD-01 | Product catalog (dresses/shoes/bags/accessories/cosmetics) | P0 | 1 | Not started | `products` |
| REQ-PROD-02 | Filters/sort (category, price, sort) | P1 | 1 | Not started | indexed |
| REQ-PROD-03 | Product detail page | P0 | 1 | Not started | |
| REQ-PROD-04 | Variants (size/color/stock) | P1 | 1 | Not started | `product_variants` |
| REQ-PROD-05 | Seller CRUD (own products) | P0 | 1 | Not started | RLS owner |
| REQ-PROD-06 | Product images (Supabase Storage) | P0 | 1 | Not started | `products.images`, C3 |

## C. Cart, Orders & Checkout

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-CART-01 | Add/view/remove cart | P0 | 2 | Not started | `cart_items` |
| REQ-ORD-01 | Checkout (COD + upfront fee) | P0 | 2 | Not started | `orders` |
| REQ-ORD-02 | My orders | P1 | 2 | Not started | RLS |
| REQ-ORD-03 | Exact COD cash shown at checkout | P0 | 2 | Not started | `orders.cod_amount`; client-repeated |
| REQ-ORD-04 | Order status lifecycle | P1 | 2 | Not started | `order_status` |

## D. Payments (Hybrid)

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-PAY-01 | Upfront fee intent (platform revenue) | P0 | 2 | Not started | Tap; `platform_upfront_fees` |
| REQ-PAY-02 | Payment webhook (signed, idempotent) | P0 | 2 | Not started | `payments.idempotency_key` |
| REQ-PAY-03 | Confirm COD (admin/agent) | P0 | 2 | Not started | C9: admin confirms v1 |
| REQ-PAY-04 | Paid ONLY when upfront AND COD | P0 | 2 | Not started | **`is_paid` STORED generated col** |
| REQ-PAY-05 | Commission settlement before payout | P0 | 2 | Not started | `settlements` |
| REQ-PAY-06 | Configurable commission/fees (admin) | P0 | 2 | Not started | `platform_settings`(+fees) BR-4 |
| REQ-PAY-07 | `PaymentProvider` abstraction (Tap; Stripe later) | P1 | 0 | Not started | `lib/payments` |

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
| REQ-SVC-04 | Provider service CRUD | P0 | 4 | Not started | RLS owner |
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
| REQ-EVT-07 | Admin verify planners | P1 | 5 | Not started | `is_verified` |

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
| REQ-NOT-01 | Email notifications (Resend) | P0 | 5 | Not started | `NotificationService` |
| REQ-NOT-02 | SMS notifications | P1 | — | **Deferred** | Phase 2 Twilio (C5; Resend email-only) |
| REQ-NOT-03 | Scheduled booking reminders | P2 | — | **Deferred** | Phase 2 edge cron |

## J. Dashboards

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-DASH-01 | Customer dashboard | P0 | 2–5 | Not started | orders/rentals/bookings/requests |
| REQ-DASH-02 | Seller dashboard | P0 | 1–2 | Not started | products/orders/revenue |
| REQ-DASH-03 | Provider dashboard | P0 | 4–5 | Not started | services/bookings/portfolio/requests |
| REQ-DASH-04 | Admin dashboard | P0 | 2–5 | Not started | approvals/COD/settings/verify/reports |
| REQ-DASH-05 | Category management | P1 | 1 | Not started | `categories` |
| REQ-DASH-06 | Reports (sales/revenue/commission) | P2 | 5 | **Deferred** (advanced) | basic now, advanced deferrable |

## K. Non-Functional

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-NFR-01 | RTL + Arabic-first bilingual | P0 | 0 | Not started | `next-intl` |
| REQ-NFR-02 | Mobile responsive / PWA-ready | P0 | 0+ | Not started | repeated by client |
| REQ-NFR-03 | RBAC isolation (sellers/providers/admin) | P0 | 0 | Not started | RLS + guards |
| REQ-NFR-04 | Performance (RSC, caching) | P1 | all | Not started | |
| REQ-NFR-05 | Security (RLS, webhook verify, validation) | P0 | all | Not started | deny-by-default |
| REQ-NFR-06 | Accessibility WCAG AA | P1 | all | Not started | DESIGN_RULES §10 |
| REQ-NFR-07 | SEO (metadata/sitemap/hreflang) | P1 | all | Not started | |
| REQ-NFR-08 | Elegant feminine design (peach/rose-gold/white) | P0 | 0+ | Not started | DESIGN_RULES |
| REQ-NFR-09 | Scalability/maintainability (enterprise/modular) | P0 | all | Not started | feature modules |
| REQ-NFR-10 | Testing (unit/integration/E2E; COD thorough) | P0 | 6 | Not started | |
| REQ-NFR-11 | Deployment (Vercel + Supabase) | P0 | 0/7 | Not started | ENV_SETUP.md |
| REQ-NFR-12 | Storage in Supabase buckets | P0 | 1 | Not started | replaces Cloudinary |

## L. AI

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-AI-01 | Smart recommendations | P2 | — | **Deferred** | Phase 3; needs interaction data + pgvector |

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
| C9 | "delivery agent" role absent | Admin confirms COD v1; `delivery_agent` Phase 2 | ✅ default |
| C10 | Currency (USD vs SAR/EGP) | Per-region currency on every monetary row | ✅ default |

---

## Changelog
- 2026-06-28 — Initial matrix from all client messages + stack decisions.
- 2026-06-28 — Conflicts C7–C10 confirmed (defaults).
- 2026-06-28 — **Upgraded to REQ-ID|Description|Priority|Phase|Status|Notes format; aligned with rebuilt DATABASE.md (provider/profile_status/portfolio_items/is_paid/platform_upfront_fees); phases + deferrals made explicit.**
- 2026-06-28 — Phase 0 progress: Tasks 0.1–0.3 done & verified. REQ-AUTH-01..05 → In progress (0.3 DB foundation live: profiles, role/provider_type/profile_status enums, signup trigger, pending state, RLS enabled — smoke-test confirmed seller=pending/customer=active, relrowsecurity=true).
