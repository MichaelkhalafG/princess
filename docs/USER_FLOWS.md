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

## 2. Products — Browse & Buy (REQ-PROD, CART, ORD, PAY)

```
Browse /products → FilterBar (category/price/sort) → ProductCard → /products/[id]
→ select variant (size/color) → AddToCart → /cart → adjust qty
→ Checkout:
   • AddressForm
   • ✦ PaymentSummary shows: subtotal, upfront fee (online), COD amount to prepare (REQ-ORD-03)
   • PayButton → create-intent (Tap) → pay upfront fee
   • ✦ webhook captures fee → order.upfront_fee_paid=true → status 'confirmed'
   • email confirmation (Resend)
→ Delivery → agent/admin collects cash → CODConfirm (admin) → cod_collected=true
→ ✦ order 'paid' ONLY now (upfront captured AND COD collected — REQ-PAY-04)
→ settlement: commission deducted, vendor net computed (REQ-PAY-05)
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

## 10. Provider onboarding (seller/service/center)

```
Register as seller/provider → profile 'pending'
→ (provider) set provider_type freelancer|center
→ admin reviews → approve → status 'active' → can create listings
→ provider adds services/availability/portfolio; seller adds products
→ (optional) provider creates event_planner profile → admin verifies
```

## 11. Seller flow (REQ-PROD-05, DASH-02)

```
/dashboard/seller → ProductManager (CRUD own products, RLS-scoped)
→ OrderManager: see orders for own products only → update fulfillment status
→ RevenueCard: gross, commission (15% configurable), net payout, settlements
```

## 12. Customer flow (REQ-DASH-01)

```
/dashboard/customer → tabs: Orders | Rentals | Bookings | Event Requests
→ track status, view details, reorder, review completed items
```

## 13. Admin flow (REQ-DASH-04)

```
/dashboard/admin →
  ApprovalsPanel: approve/reject sellers & providers (REQ-AUTH-05)
  PlannerVerifyPanel: verify/reject planners (REQ-EVT-07)
  CategoryManager: manage product/service categories (REQ-DASH-05)
  SettingsPanel: ✦ set commission (products 15 / services 10 / rentals 10) + upfront fees (REQ-PAY-06)
  CODConfirmPanel: ✦ confirm cash collected → triggers 'paid' + settlement (REQ-PAY-03/04)
  ReportsPanel: sales, revenue, commission (REQ-DASH-06)
  SettlementsPanel: review & mark vendor payouts paid (REQ-PAY-05)
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
- **Booking:** pending → confirmed → completed | cancelled | no_show
- **Rental:** pending → active → returned | cancelled
- **Event request:** pending → accepted → completed | declined | cancelled
- **Payment:** initiated → captured | failed | refunded ; cod_pending → cod_collected

Invalid transitions return `409 INVALID_TRANSITION`.
