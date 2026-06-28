# DESIGN_RULES.md

> **Project:** Princess — All-in-One Women's Marketplace
> **Status:** Binding. The **single source of truth for all UI/UX decisions.** Paired with `CLAUDE_RULES.md` (engineering rules). If a screen isn't covered here, derive from the philosophy (§1) and tokens (§2–§4) — never invent ad-hoc values.
> **Stack context:** Next.js 14 + TypeScript · Tailwind · shadcn/ui · Lucide · `next-intl` (Arabic-first RTL).

---

## 1. Overall Design Philosophy

Princess is a **premium luxury marketplace**, not a utility app. The emotional target is the **"Princess Treatment"**: the user should feel attended-to, elegant, and in control — like a queen whose every request is fulfilled instantly.

**Five pillars (every design decision must serve at least one):**

1. **Premium & luxurious** — generous whitespace, restrained palette, refined typography, soft depth. Luxury reads as *calm and confident*, never loud or cluttered.
2. **Modern feminine** — warm, sophisticated femininity (peach, rose-gold, ivory) — elegant, never childish, never stereotypically "pink-and-cute."
3. **Elegant, clean, trustworthy** — clarity over decoration; trust signals (clear pricing, COD breakdown, verified badges, reviews) are first-class.
4. **Distinctive identity** — **must never look like a generic Tailwind/shadcn default template.** We customize tokens, radii, shadows, and type so the brand is recognizable on any screen.
5. **Consistency** — one visual language across products, rentals, services, planners, dashboards, and admin. A component looks and behaves identically everywhere.

**Anti-goal:** the default "Inter + blue-600 + gray-200 borders + drop-shadow-md" look. If a screen could belong to any SaaS starter, it has failed.

---

## 2. Color System

All colors are defined **once** as CSS variables (HSL) in `app/globals.css` and mapped into `tailwind.config.ts` as semantic tokens. **Components reference semantic tokens only** (`bg-primary`, `text-muted-foreground`) — never raw hex, never `bg-pink-500`.

### 2.1 Brand palette (raw)

| Token | Hex | Role |
|-------|-----|------|
| `rose-gold` | `#B76E79` | **Primary brand** — CTAs, active states, brand accents |
| `rose-gold-deep` | `#9A5560` | Primary hover/pressed |
| `peach` | `#F8D9C4` | **Secondary** — soft fills, highlights, chips |
| `peach-soft` | `#FDEEE3` | Subtle section backgrounds |
| `champagne` | `#EBD9C0` | Tertiary accent, dividers on warm surfaces |
| `ivory` | `#FFFBF7` | App background (warm white, never pure `#fff`) |
| `pearl` | `#FFFFFF` | Card/surface background |
| `plum-ink` | `#2A2228` | Primary text (warm near-black, never `#000`) |
| `mauve-gray` | `#6E626A` | Secondary text |
| `mist` | `#A89AA1` | Muted/placeholder text |
| `gold-accent` | `#C9A227` | Sparingly: premium badges, ratings, "verified" |

### 2.2 Semantic mapping (the only names used in code)

| Semantic token | Light value | Usage rule |
|----------------|------------|------------|
| `--background` | `ivory` | Page background |
| `--foreground` | `plum-ink` | Default text |
| `--card` / `--popover` | `pearl` | Surfaces, dialogs, dropdowns |
| `--primary` | `rose-gold` | **One primary action per view.** Buttons, links, active |
| `--primary-foreground` | `pearl` | Text on primary |
| `--secondary` | `peach` | Secondary buttons, soft emphasis |
| `--accent` | `champagne` | Hover backgrounds, subtle accents |
| `--muted` | `peach-soft` | Muted sections |
| `--muted-foreground` | `mauve-gray` | Secondary text |
| `--border` | `#EFE3D8` | Hairline borders (warm, low-contrast) |
| `--input` | `#EFE3D8` | Input borders |
| `--ring` | `rose-gold` | Focus ring |
| `--success` | `#3E7C5A` | Confirmations, paid/active states |
| `--warning` | `#C58A28` | Pending, attention |
| `--destructive` | `#B23B4A` | Errors, delete, cancel |
| `--info` | `#5A7BA6` | Neutral informational |

> **Dark mode:** Phase 2. Tokens are authored so a dark theme can be added by swapping variables only — never hardcode light values in components.

### 2.3 Usage rules

- **60/30/10:** ~60% background/surfaces (ivory/pearl), ~30% secondary/neutral (peach/champagne/text), ~10% primary (rose-gold) + a whisper of gold for premium cues.
- **One primary action per screen.** Everything else is secondary/ghost.
- Status colors are **functional only** — never decorative. `success/warning/destructive/info` each have a 10%-tint background variant for badges/alerts.
- **Gold is rationed** — verified badges, star ratings, and premium package highlights only. Overuse cheapens it.
- Never introduce a color outside this system. Need a new shade? Add a token here first.

### 2.4 Text hierarchy

| Level | Token | Use |
|-------|-------|-----|
| Primary | `text-foreground` | Headings, key content |
| Secondary | `text-muted-foreground` | Supporting text, metadata |
| Tertiary | `text-mist` | Placeholders, timestamps, disabled |
| On-primary | `text-primary-foreground` | Text on rose-gold |
Minimum contrast: **4.5:1** body, **3:1** large text (§10).

---

## 3. Typography

### 3.1 Fonts

| Use | English | Arabic | Loading |
|-----|---------|--------|---------|
| **Display / Headings** | `Playfair Display` (serif, elegant) | `Tajawal` (or `IBM Plex Sans Arabic`) bold | `next/font`, subset, `display: swap` |
| **Body / UI** | `Inter` | `IBM Plex Sans Arabic` | `next/font` |
| **Numeric / tabular** | `Inter` tabular-nums | same | for prices, tables |

- Serif display gives the luxury/editorial feel (Sephora/Dior cue) and **differentiates us from the default Inter-only template**. Use serif for hero/section headings and prices on detail pages; use sans for everything functional.
- Arabic must use a font with **proper Arabic letterforms** — never let Latin fonts fall back and render broken Arabic. Font is selected per `locale` in the root layout.
- Never mix more than these two families.

### 3.2 Type scale (8px-aligned, responsive via `clamp`)

| Token | Size (desktop) | Weight | Use |
|-------|----------------|--------|-----|
| `display` | 48–60px | 700 serif | Hero |
| `h1` | 36–40px | 700 serif | Page title |
| `h2` | 28–32px | 600 serif/sans | Section |
| `h3` | 22–24px | 600 | Card title, dialog title |
| `h4` | 18–20px | 600 | Sub-section |
| `body-lg` | 18px | 400 | Lead paragraph |
| `body` | 16px | 400 | Default |
| `body-sm` | 14px | 400 | Secondary, table cells |
| `caption` | 12–13px | 500 | Labels, metadata, badges |

### 3.3 Weights & spacing

- Weights used: **400 / 500 / 600 / 700** only. No 300 (poor on Arabic), no 800/900.
- Line-height: headings `1.15–1.25`, body `1.5–1.65`. Arabic gets slightly looser line-height (`1.7`) for diacritics.
- Letter-spacing: slight negative on large serif headings (`-0.01em`); **never** letter-space Arabic.
- Max line length for reading text: ~70ch (`max-w-prose`).

---

## 4. Layout System

### 4.1 Spacing — strict 8px system

Allowed spacing values (Tailwind scale maps to these): **4, 8, 12, 16, 24, 32, 48, 64, 96px** (`1, 2, 3, 4, 6, 8, 12, 16, 24`). 4px is the smallest allowed unit (icon gaps only). **No arbitrary spacing** (`mt-[13px]` forbidden). Vertical rhythm between sections: 48–96px desktop, 32–48px mobile.

### 4.2 Containers & max widths

| Context | Max width |
|---------|-----------|
| Marketing / content | `1280px` (`max-w-7xl`) |
| Catalog / listing | `1280px` |
| Detail pages | `1120px` |
| Reading/forms/auth | `560–640px` |
| Dashboard content | fluid within sidebar, inner `max-w-screen-2xl` |
Container horizontal padding: `16px` mobile, `24px` tablet, `32px` desktop.

### 4.3 Grid

- Catalog grids: `grid` with `gap-6`; 2 cols mobile → 3 tablet → 4 desktop (products/services), 1→2→3 (planners/cards with more text).
- Detail pages: 12-col conceptual grid; media left / info right (RTL: mirrored automatically via logical properties).
- Dashboards: sidebar (`240–280px`) + fluid content; widgets in responsive `auto-fit` grid `minmax(280px,1fr)`.

### 4.4 Breakpoints (Tailwind defaults, mobile-first)

`sm 640` · `md 768` · `lg 1024` · `xl 1280` · `2xl 1536`. Design mobile-first; every layout must be verified at 360px, 768px, 1280px.

### 4.5 Radius & elevation (identity-defining — keep consistent)

- **Radius scale:** `sm 8px`, `md 12px`, `lg 16px`, `xl 24px`, `full`. Cards/dialogs = `lg`(16). Buttons/inputs = `md`(12). Chips = `full`. **No `rounded` (4px) defaults.**
- **Shadows (soft, warm, never harsh black):** define exactly 3 levels:
  - `shadow-soft` — resting cards: `0 1px 2px rgba(42,34,40,.04), 0 4px 12px rgba(183,110,121,.06)`
  - `shadow-raised` — hover/dropdowns: `0 8px 24px rgba(42,34,40,.08)`
  - `shadow-overlay` — dialogs/sheets: `0 16px 48px rgba(42,34,40,.16)`
  - **Only these three.** No `shadow-md`/`shadow-lg` ad-hoc, no pure-black shadows.

---

## 5. Component Guidelines

All components extend **shadcn/ui** primitives, restyled to our tokens (§14). Each component is built **once** in `components/ui` or `components/shared` and reused (no forks — §17).

- **Buttons** — variants: `primary` (rose-gold, one per view), `secondary` (peach), `outline` (border+transparent), `ghost` (text only), `destructive`. Sizes `sm/md/lg`. Radius `md`. Hover = `rose-gold-deep` + subtle lift; active = pressed (no lift); disabled = 50% + no pointer. Icon+label gap `8px`. Loading: spinner replaces icon, label stays, button disabled. Min tap target **44×44px**.
- **Cards** — `bg-card`, `border-border`, radius `lg`, `shadow-soft`, padding `24px` (`16px` dense). Hover (interactive cards): `shadow-raised` + `-translate-y-0.5` + image `scale-105`. Consistent structure: media → title (`h3`) → meta → price/rating → action.
- **Inputs** — height `44px`, radius `md`, `border-input`, `bg-card`; focus = `ring-2 ring-ring` + border primary; label above (`caption`, 500); helper/error text below (`body-sm`). Error state: `border-destructive` + destructive helper text + icon. Always pair with a `<Label>` (a11y).
- **Tables** (`DataTable<T>`) — Stripe-style: airy rows (`py-3`), hairline `border-border` row dividers, **no heavy grid lines**, sticky header (`bg-muted`, `caption` uppercase tracking), zebra optional (very subtle), right-aligned numerics with `tabular-nums`, row hover `bg-accent/40`. Built-in empty/loading/pagination.
- **Dialogs / Sheets** — centered modal (Sheet on mobile for forms), radius `lg`, `shadow-overlay`, backdrop `bg-plum-ink/40 backdrop-blur-sm`. Title `h3`, clear primary + cancel. Trap focus, ESC + backdrop close, restore focus on close. Destructive actions use `ConfirmDialog` with reason where relevant.
- **Dropdowns / Menus** — `bg-popover`, radius `md`, `shadow-raised`, `4px` item padding inset, hover `bg-accent`, active item check, keyboard navigable.
- **Navigation** — slim elegant top nav: logo (serif), category links, search, cart badge, locale switch, account menu. Sticky, `bg-ivory/80 backdrop-blur` on scroll, hairline bottom border. Mobile → `Sheet` drawer. Active link underlined in primary. Dashboard `Sidebar` is role-aware, collapsible, icon+label.
- **Tabs** — underline style (not boxed), active tab text `foreground` + 2px primary underline, inactive `muted-foreground`. Used in dashboards/detail sections.
- **Empty states** — never a bare "No data." Always: soft illustration/Lucide icon in a peach circle, a `h4` headline, one line of guidance, and a primary CTA (e.g. "Browse planners →"). Encouraging tone.
- **Loading states** — prefer **skeletons over spinners** for content; spinners only for button actions and short inline waits. Optimistic UI for cart/portfolio where safe.
- **Skeletons** — match the real layout's shape and spacing exactly (card skeleton = same dimensions as card). Subtle shimmer using `bg-muted` → `bg-accent` pulse, `1.5s`. Never layout-shift when real content arrives.
- **Toasts** (shadcn `sonner`/toast) — top (mobile) / bottom-end (desktop), `shadow-raised`, status-colored left accent + Lucide icon, auto-dismiss `4s` (errors `6s`, with action). Concise; one action max. Used for success/error feedback, never for critical confirmations (use dialog).

---

## 6. UX Principles

1. **Reduce clicks** — shortest path to buy/rent/book/quote. Defaults pre-filled; remember address; one-tap re-order.
2. **One clear primary action** per screen — visually dominant; secondary actions recede.
3. **Progressive disclosure** — show essentials first; reveal advanced options (variants, package details, full T&Cs) on demand. Checkout is stepped, not a wall.
4. **Error prevention > error messages** — disable invalid actions, block unavailable dates in the calendar, validate inline before submit, confirm destructive/irreversible actions.
5. **Trust by transparency** — always show price, **exact COD cash to prepare**, fees, deposit, and what's refundable *before* commit (ties to REQ-ORD-03, REQ-PAY-04).
6. **Mobile-first** — primary market is mobile; thumb-reachable actions, bottom-anchored primary CTA on mobile checkout, large tap targets.
7. **Consistency** — same patterns for the same problems everywhere; a returning user never relearns.
8. **Feedback** — every action acknowledges (toast, state change, optimistic update). Nothing feels "did it work?".
9. **Accessibility is a UX principle, not an afterthought** (§10).

---

## 7. Animation Guidelines

- **Durations:** micro (hover/focus) `150ms`; standard (dropdowns, toasts, accordions) `200–250ms`; overlays (dialog/sheet) `250–300ms`. Nothing over `350ms` for UI.
- **Easing:** `ease-out` for entering, `ease-in` for exiting; standard curve `cubic-bezier(0.16, 1, 0.3, 1)` for premium feel.
- **Hover:** subtle only — `translate-y-0.5` lift + shadow step + image `scale-105`. Never bounce or wobble.
- **Focus:** instant `ring-2 ring-ring` (no delay — accessibility).
- **Motion rules:** animate `transform` and `opacity` only (GPU-friendly); never animate layout/width/height for large elements. Stagger lists subtly (≤`30ms` step) on first load only.
- **Respect `prefers-reduced-motion`** — disable non-essential motion entirely.
- **No gratuitous animation** — motion must communicate (state change, spatial relationship), never decorate (§17).

---

## 8. Icons

- **Lucide React only.** No emoji in production UI (the sample prompt code used emoji — those are placeholders and must be replaced with Lucide icons), no mixing icon sets, no random SVGs.
- **Sizing:** `16px` inline/buttons, `20px` default UI, `24px` nav/section headers, `32px+` empty-state/feature. Use the 8px-aligned set.
- **Stroke width:** consistent `1.75` (Lucide default is 2 — we set 1.75 globally for a finer, more elegant line). Never mix stroke widths.
- Icons inherit `currentColor`; color via text tokens. Decorative icons `aria-hidden`; meaningful icons need `aria-label`.

---

## 9. Page-Specific Design References

> Use **only as inspiration for patterns and quality bar — never copy** layouts, assets, or code. For each: *why* it's the reference.

| Page | Reference | **Why** |
|------|-----------|---------|
| **Home** | Sephora, Dior Beauty | Sets the luxury-beauty tone: editorial hero, curated category tiles, premium product storytelling — exactly our "Princess Treatment" feel. |
| **Marketplace / listing** | Zara, Amazon | Zara = elegant, image-forward fashion grid (our aesthetic); Amazon = proven filtering/sort/pagination density for a real catalog. We blend Zara's beauty with Amazon's function. |
| **Search** | Amazon | Best-in-class for fast, forgiving search with filters/facets and relevance — search must "just work" across products, services, planners. |
| **Booking** | Fresha | The category leader for beauty-service booking: slot selection, provider availability, confirmation UX — directly our services/bookings model. |
| **Rentals** | Airbnb, Rent the Runway | Airbnb = date-range availability calendar + trust/reviews; RTR = the canonical fashion-rental flow (sizing, dates, deposit). Both map to our rental model. |
| **Provider profile** | Airbnb + Fresha | Airbnb = trustworthy host profile (bio, reviews, gallery, badges); Fresha = service list + book CTA. Providers need both identity and bookability. |
| **Portfolio** | Pinterest + Behance | Pinterest = masonry visual discovery (beauty work is visual); Behance = professional portfolio presentation. Our gallery must feel inspiring *and* credible. |
| **Checkout** | Apple Store | The gold standard for calm, trustworthy, minimal-friction checkout with crystal-clear pricing — critical for our hybrid upfront-fee + COD transparency. |
| **Dashboards** | Stripe + Linear + Shopify | Stripe = clarity for money/metrics; Linear = speed and refined minimalism; Shopify = proven seller/merchant management patterns. Our role dashboards need all three. |
| **Tables** | Stripe | Airy, scannable, numeric-aligned data tables — the benchmark for orders/settlements/reports. |
| **Forms** | Linear | Fast, keyboard-friendly, low-friction forms with inline validation — our preferred input experience. |
| **Authentication** | Notion | Warm, simple, unintimidating sign-up/login that reduces drop-off. |
| **Settings** | GitHub | Clear sectioning, sane grouping, safe destructive actions — ideal for admin commission/fee and account settings. |
| **Calendar** | Google Calendar + Calendly | GCal = familiar availability grid; Calendly = clean slot-picking. Our availability/booking calendars combine both. |
| **Reviews** | Airbnb | Trustworthy, structured reviews with rating summary + verified context — the trust layer for products/services/providers. |

---

## 10. Accessibility Requirements (WCAG 2.1 AA)

- Contrast ≥ **4.5:1** (body), **3:1** (large text/UI). Test every token pairing; rose-gold text on ivory must pass or be reserved for large/bold only.
- **Full keyboard operability** — all interactive elements focusable, logical tab order, visible `ring-2` focus, no keyboard traps (except intended modal focus-trap with ESC escape).
- Semantic HTML + ARIA where needed; one `<h1>` per page; landmarks (`header/nav/main/footer`).
- All inputs have associated `<Label>`; errors announced via `aria-live`; required fields marked.
- Images need `alt` (decorative = `alt=""`/`aria-hidden`). Icons conveying meaning need labels.
- Tap targets ≥ **44×44px**. Don't rely on color alone — pair status color with icon/text.
- Respect `prefers-reduced-motion`. Forms/dialogs manage focus correctly.

---

## 11. Performance-Oriented UI Rules

- `next/image` for **all** images (responsive `sizes`, lazy by default, blur placeholder, AVIF/WebP). Never raw `<img>` for content images.
- Server Components for static/content; ship minimal client JS (`'use client'` only where interactive).
- Skeletons + streaming/Suspense to avoid blank screens and CLS; reserve space for media (aspect-ratio) — **zero layout shift**.
- Virtualize/paginate long lists; never render 500 rows.
- Self-hosted fonts via `next/font` (no FOUT, no external request); preload only critical.
- Animate only `transform`/`opacity`. Debounce search/filter inputs (`300ms`).
- Target: LCP < 2.5s, CLS < 0.1, INP < 200ms on mid-range mobile.

---

## 12. Responsive Design Rules

- **Mobile-first** authoring; verify at **360 / 768 / 1280**.
- Reflow, don't shrink: multi-column → stacked; tables → card rows or horizontal scroll with sticky first column on mobile.
- Mobile primary CTA is bottom-anchored and thumb-reachable (checkout, booking confirm).
- Navigation collapses to a `Sheet` drawer < `lg`. Dashboard sidebar collapses to icons / off-canvas on mobile.
- Touch: hover-only affordances must have a tap equivalent; no hover-dependent critical info.
- Type/spacing scale down via the responsive scale (§3.2, §4.1) — never below 14px body, 44px targets.
- **PWA-ready** (REQ-NFR-02): installable manifest, themed, offline-friendly shell where feasible.

---

## 13. RTL Support (Arabic-first)

- **Arabic is the default locale**; `<html dir="rtl" lang="ar">` set per `locale` in root layout; English flips to `ltr`.
- **Use CSS logical properties / Tailwind logical utilities only** — `ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`, `text-start/end`. **Never** hardcode `ml/mr/pl/pr/left/right` for layout that must mirror.
- Icons with direction (arrows, chevrons, back) **mirror** in RTL; brand/media icons do not.
- Numbers, prices, dates formatted per locale (`Intl`); Arabic-Indic vs Latin digits per locale setting.
- Test every page in both directions; no clipped text, no mis-mirrored layout, no LTR-leaking components.
- All copy comes from `messages/ar.json` / `messages/en.json` — **no hardcoded strings** in components.

---

## 14. shadcn/ui Usage Rules

- shadcn is the **foundation, not the final look.** Install primitives, then restyle to our tokens — **the default theme must not ship.**
- Customize: `globals.css` variables (our palette), `tailwind.config` (radius, shadows, fonts), and each component's variants (`cva`) to our spec (§5).
- Add components via the CLI into `components/ui`; treat them as our source (edit freely) but keep variant APIs consistent across the app.
- Compose, don't fork: build feature components by composing `ui` primitives; never copy a primitive to tweak one style.
- Keep shadcn components accessible — don't strip the Radix a11y behavior.

---

## 15. Tailwind Conventions

- **Semantic tokens only** (`bg-primary`, `text-muted-foreground`, `border-border`) — never raw palette (`bg-pink-500`) or hex.
- **No arbitrary values** for color/spacing/radius/shadow (`p-[13px]`, `bg-[#abc]`, `shadow-[...]`) — extend the theme instead. (Rare arbitrary values allowed only for genuine one-offs like background-image positions, with a comment.)
- Use the spacing scale (§4.1) and the 3 shadows / radius scale (§4.5) exclusively.
- Class order: layout → box → typography → color → state (enforced by `prettier-plugin-tailwindcss`).
- Extract repeated class clusters into a component or `cva` variant — **never** copy-paste long class strings (DRY).
- Use `cn()` (clsx + tailwind-merge) for conditional classes. Logical utilities for RTL (§13).
- **No inline `style={{}}`** except truly dynamic values impossible in classes (e.g. computed `--progress`), and then via CSS variables.

---

## 16. Component Naming Conventions

- Files: `PascalCase.tsx` for components (`ProductCard.tsx`), `kebab-case.ts` for utils/hooks files; hooks export `useX`.
- Component names are **descriptive and domain-specific**: `BookingConfirmDialog`, not `Modal2`. Cards end in `Card`, dialogs in `Dialog`, panels in `Panel`, forms in `Form`, managers in `Manager`.
- `components/ui` = primitives (shadcn), `components/shared` = cross-feature, `components/<feature>` or `features/<feature>` = domain.
- Props interfaces named `XProps`. Boolean props read as flags (`isLoading`, `hasError`). Event props `onX`.
- One component per file (small helpers may colocate). No default-exported anonymous components.
- Variants via `cva`; never duplicate a component for a style change — add a variant.

---

## 17. Forbidden (hard "no" list)

- ❌ **Random/off-system colors** or raw hex/`bg-pink-500` in components — semantic tokens only.
- ❌ **Inconsistent spacing** / arbitrary spacing values — 8px system only.
- ❌ **Duplicated components** or copy-pasted variants — reuse + `cva` variants.
- ❌ **Inline styles** (except documented dynamic CSS-variable cases).
- ❌ **Inconsistent / harsh shadows** — only the 3 defined soft shadows; no pure-black shadows, no `shadow-2xl` flexing.
- ❌ **Low-contrast text** below WCAG AA.
- ❌ **Unnecessary / decorative animation**, bounces, long transitions, motion that ignores `prefers-reduced-motion`.
- ❌ **Generic dashboard layouts** / default shadcn theme shipped as-is — must carry the Princess identity.
- ❌ **Emoji as UI icons** in production — Lucide only.
- ❌ **Hardcoded UI strings** — all copy via `next-intl` messages.
- ❌ **Directional CSS** (`ml/mr/left/right`) that breaks RTL — logical properties only.
- ❌ **Raw `<img>`** for content — `next/image` only.
- ❌ **More than one primary CTA** competing per screen.
- ❌ **Fonts/weights outside §3**; no 300-weight; no third font family.
- ❌ **Layout shift** (CLS) from unsized media or late-loading content.

---

## Enforcement

This file is mandatory for **every** implementation phase. Each phase prompt instructs: read `CLAUDE_RULES.md` + `DESIGN_RULES.md` first, follow both, never violate them, keep the whole app visually consistent. A PR that violates a forbidden rule (§17) does not pass review. When a new pattern is needed, **add it to this document first**, then implement — the doc stays the single source of truth.

*Related: `CLAUDE_RULES.md` (engineering), `COMPONENT_TREE.md` (component inventory), `SYSTEM_ARCHITECTURE.md` (i18n/structure).*
