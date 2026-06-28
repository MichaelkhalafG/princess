# CLAUDE_RULES.md

> **Project:** Princess · How I must behave during implementation. Binding for every coding session. If a rule conflicts with a request, I surface the conflict (per the planning protocol) rather than silently breaking a rule.

---

## 0. Prime directives

1. **Requirements Matrix is law.** Every task cites `REQ-IDs`. Before writing code, verify it satisfies every related requirement. Never silently skip a requirement — mark it in the matrix if not done.
2. **Plan, then build, phase by phase.** Finish a phase to its Definition of Done before starting the next.
3. **Never silently ignore or drop a requirement or conflict.** Document, recommend, mark for confirmation.
4. **Locked stack only:** Supabase · Next.js 14 App Router + TypeScript · Tailwind + shadcn/ui · Vercel · Resend · Tap. No Prisma, no next-auth, no Cloudinary, no JS/JSX in app code (the client's sample code is reference-only).

## 1. Don't break things

- **Never rewrite working code** without cause; prefer additive, composable change.
- **Never break existing functionality** — check callers before changing a shared signature.
- Before deleting/overwriting a file, read it; if it contradicts how it was described, surface that instead of proceeding.
- Run typecheck + tests before declaring done. Report failures honestly with output.

## 2. Reuse-first (anti-duplication)

- **Always reuse** existing components, hooks, and utilities before creating new ones (see COMPONENT_TREE §Reuse map).
- No duplicated logic — extract to `lib/` or `features/<module>`.
- Shared UI lives in `components/ui` (shadcn) / `components/shared`. Don't fork a component to tweak it — parameterize it.
- One source of truth per concern: money math → `lib/money.ts`; auth → `lib/supabase` + `lib/rbac`; validation → Zod schemas in `features/*/schema.ts`.

## 3. Architecture & structure

- **Feature-module layout:** UI → `features/*` → `lib/*`. No cross-feature imports except shared types.
- **Prefer composition** over inheritance/large props blobs.
- **Keep files small** and single-responsibility; split when a file does two jobs.
- Server Components by default; `'use client'` only when interactive.
- Provider abstractions for payments/notifications/storage — never call Tap/Resend/Storage directly from feature code; go through `lib/payments`, `lib/notifications`, `lib/storage`.

## 4. TypeScript & quality

- **Strong TypeScript**: no `any` (use `unknown` + narrowing); generated `database.types.ts` for all DB access; typed API envelopes.
- **Proper naming**: descriptive, consistent (`camelCase` vars, `PascalCase` components/types, `kebab-case` files where conventional). Match surrounding style.
- **Clean folder structure** per SYSTEM_ARCHITECTURE.
- Match the surrounding code's comment density and idioms; comment the *why*, not the *what*.

## 5. Security (non-negotiable — REQ-NFR-05)

- **RLS-first**: deny-by-default; every table has policies; client uses anon key only.
- **Service-role key server-only** — never shipped to the browser.
- **Validate every input** server-side with Zod; never trust the client.
- **Webhooks**: verify signature, enforce idempotency, fail closed, never trust client capture claims.
- Secrets in env only, never committed. No logging of secrets/PII.
- RBAC enforced in two layers (RLS + app guard) — sellers see only theirs, providers only theirs, admins all (REQ-NFR-03).

## 6. Money & integrity (critical)

- An order/booking is `paid` **only when upfront fee captured AND COD confirmed** (REQ-PAY-04) — never shortcut this.
- Always show exact COD cash-to-prepare at checkout (REQ-ORD-03).
- Compute money in integer minor units; store `numeric` + `currency`; never use float arithmetic for money.
- Commission/fees always read from `platform_settings` (admin-configurable) — never hardcode 15/10%.
- Availability integrity via DB exclusion constraints + transactions — never rely on app-only checks to prevent double-booking.

> **UI/UX rules live in `DESIGN_RULES.md`** — the single source of truth for all visual decisions (colors, typography, spacing, components, animation, RTL, forbidden patterns). It is **mandatory** alongside this file for every implementation phase. The section below is the engineering summary; `DESIGN_RULES.md` is authoritative for anything visual.

## 7. UX & accessibility

- **Arabic-first, RTL** correct on every page; bilingual AR/EN via `next-intl`; no hardcoded UI strings — use `messages/*`.
- **Responsive / PWA-ready** — mobile flawless (REQ-NFR-02).
- **Accessibility** WCAG AA: keyboard nav, ARIA, focus management, contrast (leverage shadcn defaults; don't regress them).
- **Elegant feminine design**: peach / rose-gold / white tokens; "Princess Treatment" polish (REQ-NFR-08).
- Loading, empty, and error states for every async view.

## 8. Performance (REQ-NFR-04)

- RSC + caching (`revalidateTag`, ISR) for catalog; avoid client waterfalls.
- Paginate lists; index-backed queries; `next/image` for all images.
- Realtime subscriptions scoped and cleaned up.

## 9. Error handling & validation

- Typed errors with stable codes (API_MAP §Error Codes); `error.tsx`/`not-found.tsx` per segment; user-friendly toasts.
- Validate at three layers: client (UX), server (Zod, authoritative), DB (constraints, backstop).
- State-machine transitions validated → `409 INVALID_TRANSITION`.

## 10. SEO (REQ-NFR-07)

- Next metadata API per page; sitemap, robots, OpenGraph; `hreflang` for AR/EN; semantic HTML.

## 11. Testing (REQ-NFR-10)

- Unit for logic (money, settlement, validation), integration for routes, **E2E for buy/rent/book/quote**.
- ✦ **COD + payment webhook flows tested thoroughly** — the most important tests in the suite.
- RLS policy tests per table; concurrency tests for availability.

## 12. Process discipline

- For outward-facing or hard-to-reverse actions (deploys, prod migrations, sending real emails/payments), confirm first unless explicitly authorized.
- Commit/push only when asked; branch off default first; reference `REQ-IDs` in commit/PR.
- Keep `REQUIREMENTS_MATRIX.md` status current; reconcile at each phase end.
- When the client changes a requirement: edit the matrix row + changelog, assess impact on dependent rows, never delete history.

---

## Quick checklist before marking any task done
- [ ] Cites REQ-IDs and satisfies all related requirements
- [ ] Reused existing components/hooks/utils where possible
- [ ] Strong types, no `any`, generated DB types used
- [ ] RLS + app guard + Zod validation in place
- [ ] Money rules + COD `paid` rule honored
- [ ] RTL/AR + responsive + a11y + loading/empty/error states
- [ ] Tests written/passing; typecheck + lint clean
- [ ] Matrix status updated
