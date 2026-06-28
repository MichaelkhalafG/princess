# COMPONENT_TREE.md

> **Project:** Princess · Next.js 14 App Router + TypeScript + Tailwind + **shadcn/ui**.
> RTL-first. Server Components by default; `'use client'` only where interactive. Reuse-first (CLAUDE_RULES.md).

---

## 1. Pages (route → key components)

```
app/[locale]/
├── (marketing)/page.tsx              → Hero, CategoryGrid, FeaturedCarousel, HowItWorks
├── (auth)/login/page.tsx             → AuthCard + LoginForm
├── (auth)/register/page.tsx          → AuthCard + RegisterForm + RoleSelect
├── products/page.tsx                 → FilterBar, ProductGrid(ProductCard), Pagination
├── products/[id]/page.tsx            → ProductGallery, ProductInfo, VariantSelector, AddToCart, ReviewsSection
├── rentals/page.tsx                  → FilterBar, RentalGrid(RentalCard)
├── rentals/[id]/page.tsx             → ProductGallery, DateRangePicker, AvailabilityCalendar, RentSummary
├── services/page.tsx                 → ServiceFilterBar, ServiceGrid(ServiceCard)
├── services/[id]/page.tsx            → ServiceInfo, AvailabilityCalendar, SlotPicker, BookButton, PortfolioGallery, ReviewsSection
├── event-planners/page.tsx          → PlannerFilters, PlannerGrid(PlannerCard)
├── event-planners/[id]/page.tsx     → PlannerHeader, PackagesGrid, PortfolioGallery, QuoteRequestForm
├── providers/[id]/page.tsx          → ProviderHeader, PortfolioGallery, ServicesList, ReviewsSection
├── cart/page.tsx                     → CartList(CartItemRow), CartSummary
├── checkout/page.tsx                 → CheckoutSteps, AddressForm, PaymentSummary(UpfrontFee+CODBreakdown), PayButton
└── dashboard/
    ├── customer/page.tsx             → OrdersPanel, RentalsPanel, BookingsPanel, EventRequestsPanel
    ├── seller/page.tsx               → SellerStats, ProductManager, OrderManager, RevenueCard
    ├── provider/page.tsx             → ProviderStats, ServiceManager, BookingManager, PortfolioManager, EventRequestsPanel, OffersManager
    └── admin/page.tsx                → AdminStats, ApprovalsPanel, PlannerVerifyPanel, CategoryManager, SettingsPanel(Commission+Fees), CODConfirmPanel, ReportsPanel, SettlementsPanel
```

## 2. Layouts

| Layout | Scope | Contains |
|--------|-------|----------|
| `app/[locale]/layout.tsx` | root | `<html dir lang>`, `NextIntlProvider`, `ThemeProvider`, `Navbar`, `Footer`, `Toaster` |
| `(auth)/layout.tsx` | auth | centered `AuthShell`, no nav |
| `dashboard/layout.tsx` | dashboards | `DashboardShell` (role-aware `Sidebar` + `Topbar`), `RoleGuard` |
| `(marketing)/layout.tsx` | public | full-width hero shell |

## 3. Reusable Components (`components/shared` + `components/ui`)

- **ui/** (shadcn): Button, Input, Textarea, Select, Dialog, Sheet, Form, Label, Card, Table, Tabs, Badge, Avatar, Calendar, Popover, Toast/Toaster, Skeleton, DropdownMenu, Separator, Alert.
- **shared/**: `Navbar`, `Footer`, `LocaleSwitcher`, `RoleGuard`, `EmptyState`, `LoadingState`, `Pagination`, `DataTable<T>`, `PriceTag`, `RatingStars`, `StatusBadge`, `ConfirmDialog`, `SearchInput`, `ImageUploader`, `Money`.

## 4. Dialogs / Modals

| Dialog | Used in |
|--------|---------|
| `ConfirmDialog` | delete product/service/portfolio image, cancel booking |
| `PortfolioLightbox` | inside `PortfolioGallery` |
| `QuoteRequestDialog` | planner detail (alt to inline form) |
| `BookingConfirmDialog` | slot picker → confirm + fee |
| `CODConfirmDialog` | admin confirms cash collected |
| `RejectReasonDialog` | admin approvals/verification |

## 5. Forms (react-hook-form + Zod)

`LoginForm`, `RegisterForm`, `ProductForm`, `ServiceForm`, `RentalForm`, `AvailabilityForm`, `OfferForm`, `PlannerForm`, `QuoteRequestForm`, `AddressForm`, `ReviewForm`, `PortfolioUploadForm`, `SettingsForm` (commission/fees).

## 6. Cards

`ProductCard`, `RentalCard`, `ServiceCard`, `PlannerCard`, `OrderCard`, `BookingCard`, `RequestCard`, `RevenueCard`, `StatCard`, `OfferCard`, `PackageCard`.

## 7. Tables (via `DataTable<T>`)

`ProductManager` table, `OrderManager` table, `BookingManager` table, `ApprovalsPanel` table, `SettlementsPanel` table, `ReportsPanel` table, `CategoryManager` table.

## 8. Navigation

`Navbar` (logo, category links incl. **Event Planners**, search, cart badge, locale switcher, auth menu), `MobileNav` (Sheet), `DashboardSidebar` (role-aware items), `Breadcrumbs`, `Footer`.

## 9. Dashboard Widgets

`StatCard`, `RevenueCard`, `SalesChart`, `BookingsCalendarWidget`, `RecentOrdersWidget`, `IncomingRequestsWidget`, `PendingApprovalsWidget`, `CODPendingWidget`, `CommissionSettingsWidget`.

## 10. Feature Components

- **catalog/**: `FilterBar`, `ProductGrid`, `ProductGallery`, `VariantSelector`, `AddToCart`.
- **rentals/**: `DateRangePicker`, `AvailabilityCalendar`, `RentSummary`.
- **services/**: `ServiceFilterBar`, `SlotPicker`, `AvailabilityCalendar` (shared w/ rentals), `BookButton`.
- **bookings/**: `BookingManager`, `BookingCard`, `BookingStatusControl`.
- **portfolio/**: `PortfolioGallery` (grid + lightbox), `PortfolioManager` (upload/caption/associate/delete).
- **checkout/**: `CheckoutSteps`, `PaymentSummary`, `CODBreakdown`, `PayButton`.
- **reviews/**: `ReviewsSection`, `ReviewForm`, `RatingStars`.

## 11. Shared Hooks (`lib/hooks` / `features/*/hooks`)

`useSupabase`, `useUser`/`useRole`, `useCart`, `useAvailability` (Realtime), `useBookings`, `useDebounce`, `useFilters` (URL-synced), `useUpload`, `useToastError`, `usePagination`, `useLocale`, `useMoney` (format per currency/locale), `useRealtimeChannel`.

## 12. Utilities (`lib`)

`supabase/{client,server,admin,middleware}`, `payments/{PaymentProvider,tap,stripe}`, `notifications/{NotificationService,resend}`, `storage/{upload,buckets}`, `money.ts` (integer math + format), `rbac.ts`, `validation.ts` (shared Zod), `dates.ts`, `cn.ts`, `errors.ts`, `constants.ts`.

---

## Reuse map (anti-duplication)

| Reused asset | Consumers |
|--------------|-----------|
| `PortfolioGallery` | service detail, provider profile, planner detail |
| `AvailabilityCalendar` | rentals, services |
| `DataTable<T>` | every dashboard table |
| `FilterBar`/`useFilters` | products, rentals, services, planners |
| `PaymentSummary`/`CODBreakdown` | product checkout, rental, booking |
| `StatusBadge` | orders, bookings, rentals, requests, settlements |
| `Money`/`useMoney` | every price display |
| `ImageUploader`/`useUpload` | products, services, portfolio, avatar |
| `RoleGuard` | all dashboards |
