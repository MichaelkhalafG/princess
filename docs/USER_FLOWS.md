# USER_FLOWS.md

> **Project:** Princess · End-to-end flows. Each references matrix IDs. `✦` = money/integrity-critical step.

---

## 1. Authentication

```
Register → choose role (customer/seller/provider) → Supabase Auth creates user
        → trigger creates profiles row (status: customer=active; seller/provider=pending)
        → seller/provider: "awaiting approval" state, cannot list until admin approves (REQ-AUTH-05)
Login → @supabase/ssr session cookie → role-based redirect to dashboard
Logout → clear session
```

## 2. Products — Browse & Buy (REQ-PROD, MKT, VEND, CART, ORD, PAY)

```
Step 0 — ✦ market resolved or chosen (REQ-MKT-02, CR-01):
   • first visit → MarketChooser gate (geo-hinted default, NOT auto-committed)
   • thereafter cookie `market` → profiles.market
   • MarketSwitcher (sibling to LocaleSwitcher) can change it any time
   → changing market re-filters the catalog AND re-prices everything (no FX)
   • locale × market matrix = {ar,en} × {EG,SA} = 4 combos (e.g. en + EG/EGP)
Browse /products → FilterBar (category/price/sort + FacetPanel: attribute facets, REQ-PROD-09)
   → catalog shows ONLY products priced in the active market (REQ-MKT-03)
   → ProductCard → /products/[id]  (404 if not priced in active market)
→ SellerInfoCard: name, market chips, verified badge, coarse city, rating (REQ-VEND-03)
→ select variant (size/color) → AddToCart → /cart → adjust qty
→ Checkout:
   • AddressForm
   • ✦ PaymentSummary shows: subtotal, upfront fee (online), COD amount to prepare (REQ-ORD-03)
   • PayButton → create-intent (Tap) → pay upfront fee
   • ✦ webhook captures fee → order.upfront_fee_paid=true → status 'confirmed'
   • email confirmation (Resend)

Escrow lifecycle (CR-2 / Phase 2 — funds HELD, not paid on purchase):
→ pay/place → settlement 'held' (REQ-PAY-08)
→ Delivery → ✦ delivery OTP verified (admin enters on courier's behalf in v1, H-Q2)
   → order 'delivered', cod_collected=true for COD, acceptance window opens (72h, REQ-PAY-10)
→ acceptance window:
   • customer taps "Confirm receipt" (received & satisfied) → held → available (immediate)
   • OR window expires with no action → auto-release → held → available (assumed acceptance)
   • OR customer "Open dispute" during window → funds FROZEN until admin resolves (REQ-PAY-11)
→ ✦ order 'paid' = buyer paid (upfront captured AND COD collected — REQ-PAY-04);
   vendor release ('available'/'paid') is a SEPARATE axis on settlements (REQ-PAY-12)
→ settlement: commission deducted, vendor net computed; payout only from 'available' (REQ-PAY-05/13)
```

## 3. Cart (REQ-CART)

```
Add item (stock-checked) → view cart (live totals) → update qty / remove → proceed to checkout
Guest cart (optional) merges into account cart on login.
```

## 4. Checkout (REQ-ORD, PAY)

```
Cart → Address → Payment summary (upfront + COD breakdown) → pay upfront fee online
→ on capture: order created/confirmed, COD amount locked, confirmation email
Failure: payment failed → order stays 'pending', cart preserved, retry offered.
```

## 5. Rentals (REQ-RENT)

```
Browse /rentals → /rentals/[id] → DateRangePicker
→ ✦ availability check (exclusion constraint) → blocked ranges greyed in calendar
→ confirm dates → RentSummary: rental price + ✦ security deposit + upfront/booking fee
→ pay booking fee online (Tap) → rental 'pending'→'active' on capture
→ ✦ overlap attempt returns 409 DATE_CONFLICT (REQ-RENT-02)
→ pickup/delivery: remaining + deposit handling in cash
→ return → status 'returned' → deposit settled per policy (Conflict C8 — confirm)
```

## 6. Services — Book (REQ-SVC, BOOK, PAY)

```
Browse /services → filter (type/price/rating) → /services/[id]
→ view PortfolioGallery + AvailabilityCalendar → SlotPicker (free slots only)
→ ✦ select slot → BookingConfirmDialog: total, upfront fee (non-refundable), remaining cash
→ pay upfront fee → ✦ slot reserved transactionally + Realtime blocks it for others (REQ-BOOK-05)
→ booking 'confirmed' on capture → confirmation email + reminder scheduled
→ service completed → provider marks 'completed' → remaining paid in cash on completion
→ customer can review (REQ-REV)
```

## 7. Bookings management

```
Customer: /dashboard/customer → BookingsPanel (upcoming/past, cancel if allowed)
Provider: /dashboard/provider → BookingManager (confirm/complete/cancel, calendar view)
Status machine: pending → confirmed → completed | cancelled | no_show (transitions validated)
```

## 8. Portfolio (REQ-PORT)

```
Provider: /dashboard/provider → PortfolioManager
→ upload images (Supabase Storage) → caption → optionally associate with a service
→ saved to portfolio_items (profile) and/or service.portfolio_images
Public: /providers/[id] and /services/[id] show combined portfolio via PortfolioGallery
→ combined = profile items + each service's images, tagged by source (REQ-PORT-04)
```

## 9. Event Planner (REQ-EVT)

```
Browse /event-planners → filter city/specialty → PlannerCard → /event-planners/[id]
→ PlannerHeader + PackagesGrid + PortfolioGallery
→ QuoteRequestForm (event type, date, guests, budget, vision) → submit (REQ-EVT-04)
→ planner notified (email)
Provider: /dashboard/provider → EventRequestsPanel → accept/decline/complete (REQ-EVT-05)
Customer: /dashboard/customer → EventRequestsPanel tracks status (REQ-EVT-06)
Admin: verify/reject planner before public listing (REQ-EVT-07)
```

## 10. Provider onboarding (seller/service/center) — CR-01

```
Register as seller/provider → profile 'pending'
→ submit APPLICATION (REQ-VEND-01): business data + sample images + requested markets
→ submit KYC (REQ-VEND-02): legal name + ID doc(s) → PRIVATE verification-docs bucket
→ (provider) provider_type freelancer|center captured in the application
→ admin reviews the REAL submission (application + KYC together, §13):
   • approve → status 'active', markets approved (vendor_markets.is_approved), is_verified=true
   • reject → review_notes (feedback)
→ then: provider adds services/availability/portfolio; seller adds products
→ (planner) event_planner public listing gated by profiles.is_verified (no separate planner verify — Q-F1)
Multi-role (Q-C1): a user can be BOTH seller and provider (one application per role) →
   reaches both dashboards; capability derived from APPROVED applications, not profiles.role.
```

## 11. Seller flow (REQ-PROD-05, DASH-02) — CR-01

```
/dashboard/seller → ProductManager (CRUD own products, RLS-scoped)
→ ProductForm:
   • shows TWO price sets (EGP + SAR) when the seller covers BOTH markets
   • single-market seller sees ONE price set
   • attribute-option selects (per the product's category → facets, REQ-PROD-09)
   • may only price markets the seller is APPROVED for (vendor_markets.is_approved)
→ OrderManager: see orders for own products only → update fulfillment status
→ RevenueCard: gross, commission (15% configurable), held/available/paid buckets,
   net payable (available − COD-commission debt, netted), payouts (REQ-PAY-12/13)
```

## 12. Customer flow (REQ-DASH-01)

```
/dashboard/customer → tabs: Orders | Rentals | Bookings | Event Requests
→ track status, view details, reorder, review completed items
→ delivered orders (within acceptance window, CR-2) gain:
   • "Confirm receipt" (received & satisfied → releases held funds → available)
   • "Open dispute" (freezes funds pending admin resolution — REQ-PAY-11)
```

## 13. Admin flow (REQ-DASH-04)

```
/dashboard/admin →
  ApprovalsPanel: review vendor APPLICATIONS + KYC (VerificationPanel) → approve/reject
    sellers & providers, approve markets, set is_verified (REQ-AUTH-05, REQ-VEND-01/02)
    — folds in planner verification; no separate PlannerVerifyPanel (Q-F1, REQ-EVT-07)
  AttributeManager: manage attribute vocabulary (definitions/options) alongside categories (REQ-PROD-09)
  CategoryManager: manage product/service categories (REQ-DASH-05)
  SettingsPanel: ✦ set commission (products 15 / services 10 / rentals 10) + upfront fees
    + acceptance_window_hours (default 72) (REQ-PAY-06/10)
  CODConfirmPanel: ✦ COD collection now happens at delivery-OTP (confirm-delivery) (REQ-PAY-03/04)
  DisputesPanel: ✦ resolve disputes → release (available) | refund (refunded) only (REQ-PAY-11)
  ReportsPanel: sales, revenue, commission (REQ-DASH-06)
  PayoutsPanel: ✦ lists vendors + system-computed NET payable (available − COD-commission debt);
    admin transfers via bank OUTSIDE the system, clicks "Mark as paid" → available→paid +
    audit_log (REQ-PAY-12/13). Replaces the per-settlement pay action (SettlementsPanel).
```

## 14. Payments (REQ-PAY) — cross-cutting

```
create-intent (Tap) → client pays upfront fee
→ ✦ webhook (signed, idempotent) verifies capture → mark *_upfront_fee_paid
→ COD confirmed by admin/agent → mark cod_collected
→ ✦ aggregate status 'paid' requires BOTH (REQ-PAY-04)
→ settlement computes commission from platform_settings → net payout to vendor
Refunds/disputes: deposit refundable (rentals), upfront fee non-refundable (services) — Conflict C8.
```

## 15. Reviews (REQ-REV)

```
After completed order/booking → ReviewForm (1–5 + comment)
→ POST /api/reviews (one per author+target) → rating aggregation updates avg/total
→ shown in ReviewsSection on product/service/provider/planner pages
```

## 16. Notifications (REQ-NOT)

```
Triggers → NotificationService → Resend email now:
  order_confirmed, booking_confirmed, payment_received, new_event_request, booking_reminder(cron)
Phase 2: same triggers fan out to SMS (Twilio) via SmsChannel — no flow change, just channel add.
```

---

## State machines (summary)

- **Order:** pending → confirmed → out_for_delivery → delivered → completed | cancelled
  - CR-2: `delivered → completed` now means the funds became *available* — either customer accepted (§2 "Confirm receipt") OR auto-release on window expiry.
- **Booking:** pending → confirmed → completed | cancelled | no_show
- **Rental:** pending → active → returned | cancelled
- **Event request:** pending → accepted → completed | declined | cancelled
- **Payment:** initiated → captured | failed | refunded ; cod_pending → cod_collected
- **Settlement (CR-2):** held → available → paid ; held → disputed → (resolved_release → available → paid | resolved_refund → refunded)
- **Dispute (CR-2):** open → under_review → resolved_release | resolved_refund | cancelled

Invalid transitions return `409 INVALID_TRANSITION`.

---

## Changelog — CR-01 reconciliation (2026-07-01)

Reconciled against approved `CHANGE_REQUEST_01.md` (v2; escrow defaults H-Q2(a) admin-enters-OTP, H-Q3 72h global, H-Q4 release/refund only, H-Q7(a) void COD-commission debt on COD refund, H-Q8 pg_cron/Edge).

- **§2 Browse & Buy** — added Step 0 market resolution (first-visit MarketChooser, geo-hinted not auto-committed; MarketSwitcher sibling to LocaleSwitcher; changing market re-filters + re-prices); documented the {ar,en}×{EG,SA} = 4 locale×market combos; catalog now market-filtered + attribute FacetPanel; product detail renders SellerInfoCard; added the escrow lifecycle (pay/place → held → delivery-OTP → 72h acceptance window → confirm-receipt / auto-release → available; open-dispute freezes funds).
- **§10 Provider onboarding** — register → submit application (business data + sample images + KYC docs) → pending → admin reviews real submission → approve (active, markets approved, is_verified) | reject (review_notes); provider_type via application; planner listing gated by profiles.is_verified; multi-role (user can be both seller AND provider, capability from approved applications).
- **§11 Seller flow** — ProductForm shows two price sets (EGP+SAR) for both-market sellers, one for single-market; attribute-option selects; RevenueCard gains held/available/paid + net-payable netting.
- **§12 Customer dashboard** — delivered orders gain "Confirm receipt" + "Open dispute".
- **§13 Admin** — ApprovalsPanel now reviews applications + KYC (VerificationPanel), planner verify folded in; added AttributeManager, DisputesPanel, and PayoutsPanel (system-computed NET payable, manual "Mark as paid" + audit_log, replacing the per-settlement pay action); SettingsPanel gains acceptance_window_hours; COD collection moved to delivery-OTP.
- **State machines** — added Settlement (held→available→paid; held→disputed→…) and Dispute (open→under_review→resolved_*); extended Order (delivered→completed = accepted or auto-release).
