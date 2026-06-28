# PROJECT_ANALYSIS.md

> **Project:** Princess — All-in-One Women's Marketplace
> Companion to `REQUIREMENTS_MATRIX.md`. Read both before implementation.

---

## 1. Complete Project Overview

Princess is a **multi-vendor, three-in-one marketplace** for women in Saudi Arabia and Egypt, combining:

1. **Products (Buy)** — dresses, shoes, bags, accessories, cosmetics.
2. **Rentals (Rent)** — dresses and occasion items for a date range.
3. **Services (Book)** — makeup, hair, nails, massage, body care, beauty-center offers.

Two addendum pillars extend it:

4. **Event Planning** — browse planners (individuals/agencies), view portfolios, send quote requests.
5. **Portfolio Gallery** — visual showcase for **all** providers, shown on service pages and public profiles.

The experience promise is **"Princess Treatment"**: the user should feel like a queen — instant, elegant, frictionless. This is a brand/UX constraint, not just copy (see REQ-NFR-08).

The defining commercial mechanic is a **hybrid payment model**: a small **upfront online fee** (platform revenue, confirms the order/slot) plus **Cash on Delivery / on completion** for the balance. This is essential for the SA/EG market where COD trust is high.

---

## 2. Business Goals

- Capture three high-frequency women's spend categories in one app to maximize basket and retention.
- Monetize via **commission** (products 15%, services/rentals 10%, admin-configurable) + the **upfront fee** as a booking guarantee / no-show deterrent.
- Win the SA/EG market through **COD + local payment (Tap/mada)** and **Arabic-first RTL** UX.
- Build a **provider supply side** (sellers, freelancers, beauty centers, event planners) with self-service dashboards.

## 3. Target Users

- **Primary:** Arabic-speaking women in Saudi Arabia and Egypt; mobile-first; mixed payment trust (prefer COD, accept small online fees).
- **Supply side:** independent sellers, freelance beauty professionals, beauty centers, event planners/agencies.
- **Platform operator:** admin/ops team approving vendors, confirming COD, running settlements.

## 4. User Roles

| Role | Can do | Cannot do |
|------|--------|-----------|
| **Customer** | Browse, buy, rent, book, request quotes, pay upfront fee, review, manage own orders/bookings/requests | See other customers' data; manage listings |
| **Seller** | CRUD own products, manage own orders, view own sales/revenue | See others' products/orders; touch services |
| **Service Provider** (`freelancer`/`center`) | CRUD own services, set availability, manage bookings, manage portfolio, run center offers, act as event planner, manage event requests | See others' bookings; manage products |
| **Admin** | Approve sellers/providers, verify planners, manage categories, configure commission/fees, confirm COD, run settlements, view all reports | — (full access via service role, audited) |

## 5. Business Rules

- **BR-1 (Order Paid definition):** An order/booking is `paid` **only when the upfront fee is captured AND the COD balance is confirmed collected**. (Explicit client rule — REQ-PAY-04.)
- **BR-2 (Upfront fee destination):** Upfront fee goes to the **platform** directly (revenue / commission guarantee).
- **BR-3 (Settlement):** Platform deducts commission from the total before paying out seller/provider; upfront fee offsets commission.
- **BR-4 (Commission defaults):** Products 15%; services & rentals 10%; **configurable in admin** (REQ-PAY-06).
- **BR-5 (COD transparency):** Exact cash-to-prepare must be shown at checkout (REQ-ORD-03).
- **BR-6 (No double-booking):** A rented item or booked time-slot cannot be double-allocated (REQ-RENT-02, REQ-SVC-05).
- **BR-7 (Vendor approval):** Sellers/providers require admin approval before listings are public (REQ-AUTH-05); planners require verification (REQ-EVT-07).
- **BR-8 (RBAC isolation):** Sellers see only their data; providers only theirs; admins all (REQ-NFR-03).
- **BR-9 (Fee refundability):** Upfront/booking fee for services is **non-refundable**; rental **security deposit** is refundable on safe return. (See Conflict C8 — needs deposit policy confirmation.)

## 6. Success Criteria

- A customer can complete each of: buy (COD+fee), rent (date-range, deposit+fee), book (slot+fee), and send an event quote — end-to-end.
- COD flow verified: order only flips to `paid` when both conditions met.
- No double-booking possible under concurrent attempts (tested).
- Each role sees only permitted data (RLS-verified).
- Arabic RTL UI renders correctly across all pages on mobile.
- Admin can change commission and see it reflected in settlement math.
- Deploys cleanly to Vercel + Supabase.

## 7. Future Scalability

- Provider abstractions (`PaymentProvider`, `NotificationService`, `StorageService`) allow adding Stripe, Twilio/WhatsApp, CDN without refactor.
- Feature-module folder layout supports adding categories (e.g., catering, photography) by cloning a module.
- Postgres + RLS scales to multi-tenant; read replicas / caching layer addable.
- i18n scaffolding ready for more locales (Gulf dialects, EN, FR).
- AI recommendations (REQ-AI-01) added once interaction data accrues.

## 8. Known Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| **5-day full-scope deadline** | Quality/testing depth | **High** | Strict module sequencing; reuse-first; honest DoD; flag any cut to matrix |
| Payment webhook correctness (capture, idempotency, signature) | Revenue integrity | High | Dedicated payment module, idempotency keys, replay-safe handlers, sandbox tests |
| Concurrency on availability (double-booking) | Customer trust | High | DB-level exclusion constraints + transactional booking + Realtime UI |
| RLS misconfiguration | Data leak | High | Policy tests per table; deny-by-default; service role only server-side |
| Tap integration unknowns (sandbox access, mada specifics) | Schedule | Med | Abstraction lets us mock provider; spike Tap day 1 |
| Sample code is JS/Prisma/Cloudinary | Wasted copy-paste | Med | Treat as reference only; rewrite in TS+Supabase |

## 9. Unknown Risks

- Tap Payments sandbox/account provisioning lead time for the client.
- Legal/tax requirements for marketplace settlements in SA vs EG (VAT, e-invoicing/ZATCA).
- COD reconciliation operational process (who is the "delivery agent"? owned fleet or 3rd-party?).
- Refund/dispute handling for non-refundable fees vs consumer protection law.
- Image moderation needs (user-uploaded portfolio content).

## 10. Missing Information

- Exact upfront-fee amounts per category (examples conflict — see C7).
- Rental security-deposit refund policy and damage handling (C8).
- Delivery/logistics integration (carrier? self-pickup? agent app?).
- Currency handling: SAR vs EGP — multi-currency or per-region? (assumed per-region; **confirm**).
- KYC/verification depth for vendors and planners.
- Tax/VAT display and invoicing requirements.
- Who confirms COD collection operationally (admin vs delivery agent role — note: client mentioned "delivery agent" but no such role defined).

## 11. Conflicting Requirements

| C-ID | Conflict | Recommended decision | Status |
|------|----------|---------------------|--------|
| C1 | Prisma (`schema.prisma`) vs **Supabase** | Supabase migrations (SQL) + generated TS types + RLS. Drop Prisma. | ✅ Confirmed |
| C2 | `next-auth`/`getServerSession` vs **Supabase Auth** | Supabase Auth via `@supabase/ssr`. | ✅ Confirmed |
| C3 | Cloudinary vs **Supabase Storage** | Supabase Storage buckets (`products`, `services`, `portfolio`, `avatars`). | ✅ Confirmed |
| C4 | `.jsx`/JS sample code vs **TypeScript** | All sample code is reference-only; reimplement typed. | ✅ Confirmed |
| C5 | Resend (email-only) vs **required SMS** | Email now via Resend; provider-agnostic `NotificationService`; **Twilio SMS = Phase 2**. | ✅ Confirmed |
| C6 | App-layer role checks vs platform | **RLS-first** + app-layer guards as defense-in-depth. | ✅ Confirmed |
| C7 | Upfront fee amounts inconsistent ($1 / $10 / 100 EGP / 50 EGP) | Make fee **configurable per category & currency** in `platform_settings`. | ✅ Confirmed (default) |
| C8 | "non-refundable booking fee" vs rental "security deposit/booking fee" | Two fields: `upfront_fee` (non-refundable platform revenue) + `security_deposit` (refundable). | ✅ Confirmed (default) |
| C9 | "delivery agent collects cash" but no delivery-agent role exists | Admin confirms COD for v1; add `delivery_agent` role in Phase 2. | ✅ Confirmed (default) |
| C10 | Currency: USD examples but SAR/EGP market | Per-region currency (SAR for SA, EGP for EG); store currency on monetary records. | ✅ Confirmed (default) |

## 12. Recommended Decisions (summary)

1. **Database access:** Supabase JS client (server + browser via `@supabase/ssr`), SQL migrations checked into `supabase/migrations`, generated types in `lib/database.types.ts`. No Prisma.
2. **RBAC:** Postgres RLS policies are the source of truth; `middleware.ts` + server guards for routing/UX.
3. **Payments:** `lib/payments/PaymentProvider.ts` interface; `TapProvider` live; `StripeProvider` stub; webhook with signature verification + idempotency table.
4. **Money model:** all amounts in minor units (integers) + `currency` column; never floats for money in logic (store `numeric` in DB, compute in integers).
5. **Notifications:** `lib/notifications/NotificationService.ts`; `ResendEmailChannel` now; `SmsChannel` interface ready for Twilio.
6. **Storage:** Supabase Storage; signed upload via server route; public read for catalog images, RLS for private.
7. **i18n:** `next-intl`, Arabic default + RTL, `app/[locale]/...` routing.
8. **Availability integrity:** Postgres `btree_gist` exclusion constraints for rentals/bookings; transactional create.
9. **Fees/commission:** single `platform_settings` table; admin-editable; all settlement math reads from it.
10. **Testing of money/COD:** treat REQ-PAY-04 + REQ-ORD-03 as P0 E2E scenarios — non-negotiable.

> ✅ **Items C7–C10 confirmed by client on 2026-06-28** (accept recommended defaults). **All 10 conflicts are now resolved.** No open conflicts remain blocking implementation.
