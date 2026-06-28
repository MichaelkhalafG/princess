# PHASE 0 — Foundation & Spike · Claude Code Task Pack

> **Project:** Princess — All-in-One Women's Marketplace
> **Phase goal (from IMPLEMENTATION_PLAN.md):** Project skeleton, Supabase wired, auth + RBAC + RTL working, Tap sandbox spike.
> **Phase acceptance:** A user can register/login; role redirect works; AR RTL renders; Tap sandbox returns a token.
> **Phase DoD:** Deploys green to Vercel; typecheck + lint pass; RLS deny-by-default verified.
> **Final commit (whole phase):** `chore(foundation): scaffold next14+supabase, auth, rbac, i18n, tap spike`

---

## How to use this file

Each task below is a self-contained unit for a single Claude Code session. Run them **in order** — later tasks depend on earlier ones. For each task:

1. Paste the **Prompt** block into Claude Code.
2. Claude works against the **Files** list (creates/edits only those, unless it surfaces a needed addition).
3. Do **not** mark done until every **DoD** checkbox passes (`typecheck`, `lint`, stated tests).
4. The task **REQ-IDs** must be satisfied or explicitly marked deferred in `REQUIREMENTS_MATRIX.md` — never silently skipped (CLAUDE_RULES §0).

> ### ⛔ MANDATORY PROJECT STANDARDS — applies to EVERY task below
> Before writing **any** code in **any** task in this file, you must:
> 1. **Read `docs/CLAUDE_RULES.md`** (engineering standards).
> 2. **Read `docs/DESIGN_RULES.md`** (the single source of truth for all UI/UX).
> 3. **Follow both documents fully** before writing any code.
> 4. **Never violate** any rule in either document (see `DESIGN_RULES.md §17 — Forbidden`).
> 5. **Keep the entire application visually consistent** with the established design system (color tokens, typography, 8px spacing, the 3 shadows, component specs, RTL).
>
> These two files are **mandatory project standards**. A task that breaks a forbidden rule does not pass review. If a needed pattern is missing, add it to the relevant rules doc first, then implement. This instruction is repeated at the top of every prompt block so it is never skipped.

**Binding rules for every task (CLAUDE_RULES.md + DESIGN_RULES.md):** locked stack only (Supabase · Next 14 App Router + TS · Tailwind + shadcn/ui · Vercel · Resend · Tap); no Prisma / next-auth / Cloudinary; no `any`; RLS deny-by-default; provider abstractions for payments/notifications/storage; Arabic-first RTL with no hardcoded UI strings; **all UI built to `DESIGN_RULES.md` (semantic tokens only, no raw hex/`bg-pink-500`, 8px spacing, defined radii/shadows, Lucide icons, no default shadcn theme, no emoji UI)**; surface conflicts instead of silently breaking a rule.

**Prerequisites before Task 0.1:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TAP_SECRET_KEY`, `TAP_WEBHOOK_SECRET`, `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL` available to paste into `.env.local` and Vercel.

**Task index**

| # | Task | Key REQ-IDs |
|---|------|-------------|
| 0.1 | Project scaffold (Next 14 + TS + Tailwind + shadcn) | REQ-NFR-01/02/08 |
| 0.2 | Supabase clients + env wiring | REQ-NFR-03/05 |
| 0.3 | DB foundation: extensions, enums, `profiles`, signup trigger | REQ-AUTH-01..05 |
| 0.4 | RLS baseline (deny-by-default) + `platform_settings` seed | REQ-NFR-05, REQ-PAY-06 |
| 0.5 | i18n + RTL shell (`next-intl`, `[locale]`, theme tokens) | REQ-NFR-07/08 |
| 0.6 | Middleware: auth refresh + locale + RBAC routing | REQ-NFR-03 |
| 0.7 | Auth feature: routes, forms, role redirect | REQ-AUTH-01..05 |
| 0.8 | Provider abstractions: PaymentProvider + Tap stub, NotificationService + Resend | REQ-PAY-*, REQ-NOT-01 |
| 0.9 | Tap sandbox spike (create-intent proof) | REQ-PAY-01 |
| 0.10 | Shared primitives: Navbar/Footer/LocaleSwitcher/RoleGuard | REQ-NFR-07/08 |
| 0.11 | Phase DoD gate: deploy, typecheck/lint, RLS smoke, matrix reconcile | Phase DoD |

---

## Task 0.1 — Project scaffold (Next 14 App Router + TS + Tailwind + shadcn/ui)

**REQ-IDs:** REQ-NFR-01 (stack), REQ-NFR-02 (responsive/PWA-ready), REQ-NFR-08 (feminine theme tokens)

**Objective:** Stand up the Next.js 14 App Router TypeScript project with Tailwind and shadcn/ui installed, strict TS config, lint, and the feature-module folder skeleton from SYSTEM_ARCHITECTURE §2.

**Prompt:**
```
MANDATORY FIRST STEPS (do before writing any code):
1. Read docs/CLAUDE_RULES.md (engineering standards).
2. Read docs/DESIGN_RULES.md (single source of truth for all UI/UX).
3. Follow BOTH documents fully before writing any code.
4. Never violate any rule in either document (see DESIGN_RULES.md §17 Forbidden).
5. Keep the entire application visually consistent with the established design system
   (semantic color tokens only, typography scale, 8px spacing, defined radii/shadows,
   Lucide icons, RTL-correct logical properties, no default shadcn theme, no emoji UI).

Scaffold the Princess project per SYSTEM_ARCHITECTURE.md and CLAUDE_RULES.md.

Stack (locked, do not substitute): Next.js 14 App Router, TypeScript (strict), Tailwind CSS, shadcn/ui, pnpm. No Prisma, no next-auth, no Cloudinary.

Do:
1. Initialize a Next.js 14 App Router project in TypeScript with the `app/` directory and strict mode on in tsconfig (`strict: true`, `noUncheckedIndexedAccess: true`). Forbid `any`.
2. Install and configure Tailwind. Add the Princess theme tokens as CSS variables: peach, rose-gold, white as the core palette (REQ-NFR-08). Wire them into tailwind.config via the shadcn token convention.
3. Install shadcn/ui (init) and add these primitives only: button, input, textarea, select, dialog, sheet, form, label, card, table, tabs, badge, avatar, calendar, popover, toast/toaster, skeleton, dropdown-menu, separator, alert. Place wrappers under components/ui.
4. Create the empty feature-module folder skeleton exactly as SYSTEM_ARCHITECTURE §2: app/, components/{ui,shared,catalog,rentals,services,bookings,portfolio,checkout,dashboard}, features/, lib/{supabase,payments,notifications,storage}, messages/, supabase/{migrations,functions}, tests/{unit,integration,e2e}. Add .gitkeep where empty.
5. Add scripts: dev, build, typecheck (tsc --noEmit), lint, test. Configure ESLint + Prettier matching a TS/Next setup.
6. Add a PWA-ready baseline: web manifest stub + viewport meta (do NOT build full PWA yet — REQ-NFR-02 baseline only).
7. Do NOT add any feature logic yet. No auth, no DB calls.

Constraints: no `any`; kebab-case filenames; PascalCase components; server components by default.

When done: run `pnpm typecheck` and `pnpm lint` and report output. Do not commit.
```

**Files (create/edit):**
- `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.js`
- `.eslintrc` / `eslint.config.mjs`, `.prettierrc`, `.gitignore`
- `app/layout.tsx`, `app/globals.css`
- `components/ui/*` (shadcn primitives)
- Folder skeleton with `.gitkeep`
- `public/manifest.webmanifest`

**Tests / verification:**
- `pnpm typecheck` → clean
- `pnpm lint` → clean
- `pnpm build` → succeeds
- Theme tokens resolve (peach/rose-gold/white classes render)

**DoD:**
- [ ] Strict TS on; no `any` anywhere
- [ ] shadcn primitives installed under `components/ui`
- [ ] Folder skeleton matches SYSTEM_ARCHITECTURE §2
- [ ] `typecheck` + `lint` + `build` pass
- [ ] Theme tokens (peach/rose-gold/white) wired

**Suggested commit:** `chore(scaffold): next14 ts app router, tailwind, shadcn, theme tokens, module skeleton`

---

## Task 0.2 — Supabase clients + env wiring

**REQ-IDs:** REQ-NFR-03 (RBAC plumbing), REQ-NFR-05 (security: service-role server-only, anon on client)

**Objective:** Wire the three Supabase access surfaces (`client`, `server`, `admin`) via `@supabase/ssr`, plus a generated types placeholder, with the service-role key strictly server-side.

**Prompt:**
```
MANDATORY FIRST STEPS (do before writing any code):
1. Read docs/CLAUDE_RULES.md (engineering standards).
2. Read docs/DESIGN_RULES.md (single source of truth for all UI/UX).
3. Follow BOTH documents fully before writing any code.
4. Never violate any rule in either document (see DESIGN_RULES.md §17 Forbidden).
5. Keep the entire application visually consistent with the established design system
   (semantic color tokens only, typography scale, 8px spacing, defined radii/shadows,
   Lucide icons, RTL-correct logical properties, no default shadcn theme, no emoji UI).

Wire Supabase access per SYSTEM_ARCHITECTURE §6/§7 and CLAUDE_RULES §5.

Do:
1. Add @supabase/ssr and @supabase/supabase-js.
2. Create lib/supabase/client.ts — browser client using ONLY the anon key (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY).
3. Create lib/supabase/server.ts — cookie-based server client (createServerClient) for RSC and Route Handlers, reading/writing cookies via next/headers.
4. Create lib/supabase/admin.ts — service-role client. Must throw if imported in a client bundle. Guard with a server-only check (import 'server-only'). Reads SUPABASE_SERVICE_ROLE_KEY. Add a clear comment: NEVER import from client components.
5. Create lib/database.types.ts as a placeholder generated-types file (empty Database type for now); add a pnpm script `db:types` that runs `supabase gen types typescript --linked > lib/database.types.ts`. All DB access must be typed against this.
6. Create .env.example listing every required var: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, TAP_SECRET_KEY, TAP_WEBHOOK_SECRET, RESEND_API_KEY, NEXT_PUBLIC_APP_URL. Never commit real secrets.

Constraints: service-role key must never be reachable from a client component or shipped to the browser. No `any`. Type every client with the Database generic.

When done: typecheck + lint, report output. Do not commit.
```

**Files:**
- `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`
- `lib/database.types.ts` (placeholder)
- `.env.example`, `package.json` (add `db:types` script)

**Tests / verification:**
- `pnpm typecheck` clean
- Static check: `admin.ts` includes `import 'server-only'` and is not imported by any `'use client'` file
- Client/server clients instantiate without runtime error in a throwaway RSC

**DoD:**
- [ ] Three clients exist; admin is server-only and guarded
- [ ] Anon key only on the browser client
- [ ] `database.types.ts` placeholder + `db:types` script present
- [ ] `.env.example` lists all 7 vars; no real secrets committed
- [ ] typecheck + lint pass

**Suggested commit:** `feat(supabase): ssr client/server/admin wiring, env example, generated types script`

---

## Task 0.3 — DB foundation: extensions, enums, `profiles`, signup trigger

**REQ-IDs:** REQ-AUTH-01 (register), REQ-AUTH-02 (login plumbing), REQ-AUTH-03 (roles), REQ-AUTH-04 (profile on signup), REQ-AUTH-05 (seller/provider pending until admin approval)

**Objective:** First SQL migration: required extensions, role/status enums, the `profiles` table, and the trigger that creates a `profiles` row on `auth.users` insert with correct default status.

> Cross-check enum/column names against **DATABASE.md** before writing SQL. If a name there differs, follow DATABASE.md and note the reconciliation.

**Prompt:**
```
MANDATORY FIRST STEPS (do before writing any code):
1. Read docs/CLAUDE_RULES.md (engineering standards).
2. Read docs/DESIGN_RULES.md (single source of truth for all UI/UX).
3. Follow BOTH documents fully before writing any code.
4. Never violate any rule in either document (see DESIGN_RULES.md §17 Forbidden).
5. Keep the entire application visually consistent with the established design system
   (semantic color tokens only, typography scale, 8px spacing, defined radii/shadows,
   Lucide icons, RTL-correct logical properties, no default shadcn theme, no emoji UI).

Write the first Supabase SQL migration for Princess per DATABASE.md, SYSTEM_ARCHITECTURE §8, and PROJECT_ANALYSIS User Roles.

Create supabase/migrations/0001_foundation.sql containing:
1. Extensions: pgcrypto, btree_gist (btree_gist needed later for availability; enable now).
2. Enums:
   - user_role: customer, seller, provider, admin
   - provider_type: freelancer, center
   - profile_status: active, pending, suspended
   (Use the exact names/values from DATABASE.md if they differ — DATABASE.md wins.)
3. Table public.profiles:
   - id uuid PK references auth.users(id) on delete cascade
   - role user_role not null default 'customer'
   - provider_type provider_type null
   - status profile_status not null
   - full_name text, phone text, avatar_url text
   - created_at / updated_at timestamptz default now()
4. A trigger function handle_new_user() + trigger on auth.users AFTER INSERT that inserts a profiles row:
   - role taken from raw_user_meta_data->>'role' (default 'customer')
   - status = 'active' when role='customer', else 'pending' (REQ-AUTH-05)
5. updated_at touch trigger.

Constraints: idempotent-friendly (use IF NOT EXISTS where valid); no RLS policies in THIS migration (that's the next task) but DO enable row level security on profiles so it is deny-by-default until policies are added. Pure SQL, no app code.

After writing, regenerate types: run the db:types script and report the diff. Do not commit.
```

**Files:**
- `supabase/migrations/0001_foundation.sql`
- `lib/database.types.ts` (regenerated)

**Tests / verification:**
- Apply migration to a local/branch Supabase, confirm no errors
- Insert a test `auth.users` row with `role=seller` meta → `profiles.status='pending'`
- Insert with `role=customer` (or none) → `profiles.status='active'`
- `profiles` has RLS enabled (so currently denies all anon/auth reads)

**DoD:**
- [ ] Migration applies cleanly
- [ ] Enums + `profiles` match DATABASE.md
- [ ] Signup trigger sets status correctly per role (REQ-AUTH-05)
- [ ] RLS enabled on `profiles` (deny-by-default)
- [ ] Types regenerated

**Suggested commit:** `feat(db): foundation migration — extensions, enums, profiles, signup trigger`

---

## Task 0.4 — RLS baseline + `platform_settings` seed

**REQ-IDs:** REQ-NFR-05 (RLS-first, deny-by-default), REQ-NFR-03 (role isolation), REQ-PAY-06 (admin-configurable commission/fees), REQ-PAY-04 / BR-4 (settings are source of truth for money math)

**Objective:** Establish the RLS pattern on `profiles` (self-read/update; admin-all) and create `platform_settings` with seeded commission and per-category/currency upfront-fee defaults (resolves Conflict C7).

**Prompt:**
```
MANDATORY FIRST STEPS (do before writing any code):
1. Read docs/CLAUDE_RULES.md (engineering standards).
2. Read docs/DESIGN_RULES.md (single source of truth for all UI/UX).
3. Follow BOTH documents fully before writing any code.
4. Never violate any rule in either document (see DESIGN_RULES.md §17 Forbidden).
5. Keep the entire application visually consistent with the established design system
   (semantic color tokens only, typography scale, 8px spacing, defined radii/shadows,
   Lucide icons, RTL-correct logical properties, no default shadcn theme, no emoji UI).

Write supabase/migrations/0002_rls_and_settings.sql per CLAUDE_RULES §5/§6, PROJECT_ANALYSIS Business Rules (BR-2..BR-5), and Conflicts C7/C10.

A) RLS on public.profiles (deny-by-default already enabled):
   - SELECT: a user can read their own row (auth.uid() = id).
   - UPDATE: a user can update their own row (no role/status self-escalation — restrict updatable columns to full_name, phone, avatar_url via a policy or trigger; role/status only changeable by admin).
   - Admin: full access path is via service-role (server only) — do NOT add a broad public admin policy; document that admin ops use the service-role client.
   - Provide a reusable SQL helper or pattern (e.g. a SECURITY DEFINER function current_role() reading profiles) if needed for later tables, but keep it minimal.

B) Table public.platform_settings (single source of truth for money config — never hardcode 15/10%):
   - commission_products numeric not null default 15
   - commission_services numeric not null default 10
   - commission_rentals numeric not null default 10
   - upfront_fee config that is per-category AND per-currency (C7 + C10): store as jsonb or a child table keyed by (category, currency) with amounts in MINOR UNITS (integers). Pick the cleaner of the two and justify in a comment.
   - currency support: SAR and EGP (per-region, C10).
   - updated_by uuid, updated_at timestamptz.
   - RLS: public/auth = SELECT allowed (settings like fees are needed at checkout); writes only via service-role (admin). Enable RLS, add the SELECT policy, no write policy (service-role bypasses).
   - Seed one row with the BR-4 defaults.

Constraints: money amounts in integer minor units; numeric in DB; never floats in logic. No app code. Idempotent where valid.

After writing, regenerate types and report. Do not commit.
```

**Files:**
- `supabase/migrations/0002_rls_and_settings.sql`
- `lib/database.types.ts` (regenerated)

**Tests / verification:**
- As anon: `select` on another user's `profiles` row → denied; own row → allowed after auth
- A user cannot `update` their own `role`/`status`
- `platform_settings` seeded row readable by authed user; not writable except via service role
- Upfront fee retrievable per (category, currency) and stored in minor units

**DoD:**
- [ ] `profiles` RLS: self read/update only; no privilege escalation
- [ ] `platform_settings` exists, seeded with BR-4 defaults, fees per category+currency in minor units (C7/C10)
- [ ] Settings readable for checkout; writable only via service-role
- [ ] Deny-by-default proven on a non-owned row
- [ ] Types regenerated

**Suggested commit:** `feat(db): profiles RLS baseline + platform_settings (commission/fees) seed`

---

## Task 0.5 — i18n + RTL shell (`next-intl`, `app/[locale]`, theme)

**REQ-IDs:** REQ-NFR-07 (bilingual AR/EN, RTL), REQ-NFR-08 (feminine RTL-correct design), REQ-NFR-01 (next-intl, locked)

**Objective:** Locale-prefixed routing with `ar` default, `<html dir lang>` set per locale, `messages/{ar,en}.json`, and the root layout shell with theme provider. No hardcoded UI strings anywhere.

**Prompt:**
```
MANDATORY FIRST STEPS (do before writing any code):
1. Read docs/CLAUDE_RULES.md (engineering standards).
2. Read docs/DESIGN_RULES.md (single source of truth for all UI/UX).
3. Follow BOTH documents fully before writing any code.
4. Never violate any rule in either document (see DESIGN_RULES.md §17 Forbidden).
5. Keep the entire application visually consistent with the established design system
   (semantic color tokens only, typography scale, 8px spacing, defined radii/shadows,
   Lucide icons, RTL-correct logical properties, no default shadcn theme, no emoji UI).

Add internationalization + RTL per SYSTEM_ARCHITECTURE §5/§6, CLAUDE_RULES §7, COMPONENT_TREE §2.

Do:
1. Install next-intl. Configure app/[locale] routing with ar as default locale and en as the second locale.
2. Add the next-intl middleware piece (locale negotiation) — but DESIGN it so it can be composed with the auth+RBAC middleware in Task 0.6 (export a composable function, don't hardcode a single default export that blocks chaining).
3. app/[locale]/layout.tsx must set <html dir={locale==='ar'?'rtl':'ltr'} lang={locale}> and wrap children in NextIntlClientProvider + ThemeProvider + Toaster (from shadcn). Move the root html/body here per next-intl app-router pattern.
4. Create messages/ar.json and messages/en.json with initial keys for: nav (home, products, rentals, services, eventPlanners, login, register, dashboard), auth (email, password, fullName, role, submit), common (loading, empty, error). Arabic is the source-of-truth content; provide proper Arabic, not placeholders.
5. Add a typed useMessages/getTranslations usage example in a tiny marketing landing page at app/[locale]/(marketing)/page.tsx that pulls ALL its strings from messages (zero hardcoded UI text).
6. Verify RTL: Arabic locale must render right-to-left with correct logical properties (use Tailwind logical utilities / dir-aware classes).

Constraints: NO hardcoded UI strings — everything via messages/*. ar default. Server components by default.

When done: typecheck + lint, and describe how to view /ar and /en. Do not commit.
```

**Files:**
- `i18n.ts` / `i18n/request.ts` (next-intl config), `next.config.mjs` (plugin)
- `middleware.ts` (locale piece, composable — finalized in 0.6)
- `app/[locale]/layout.tsx`, `app/[locale]/(marketing)/page.tsx`
- `messages/ar.json`, `messages/en.json`
- `components/shared/ThemeProvider.tsx` (if needed)

**Tests / verification:**
- `/ar` renders `dir="rtl" lang="ar"`; `/en` renders `dir="ltr" lang="en"`
- Landing page strings all come from `messages/*` (grep for hardcoded text → none)
- `pnpm typecheck` + `lint` clean

**DoD:**
- [ ] `ar` default locale, `en` secondary; locale-prefixed routes
- [ ] `<html dir lang>` correct per locale
- [ ] `messages/{ar,en}.json` with real Arabic; zero hardcoded UI strings
- [ ] Locale middleware is composable for Task 0.6
- [ ] typecheck + lint pass

**Suggested commit:** `feat(i18n): next-intl ar/en routing, rtl shell, message catalogs`

---

## Task 0.6 — Middleware: auth refresh + locale + RBAC routing

**REQ-IDs:** REQ-NFR-03 (RBAC second layer / route guards), REQ-NFR-05 (session handling), REQ-AUTH-02 (session)

**Objective:** Single `middleware.ts` that (a) refreshes the Supabase session via `@supabase/ssr`, (b) applies locale negotiation, (c) guards `/dashboard/*` by role, redirecting unauthorized users.

**Prompt:**
```
MANDATORY FIRST STEPS (do before writing any code):
1. Read docs/CLAUDE_RULES.md (engineering standards).
2. Read docs/DESIGN_RULES.md (single source of truth for all UI/UX).
3. Follow BOTH documents fully before writing any code.
4. Never violate any rule in either document (see DESIGN_RULES.md §17 Forbidden).
5. Keep the entire application visually consistent with the established design system
   (semantic color tokens only, typography scale, 8px spacing, defined radii/shadows,
   Lucide icons, RTL-correct logical properties, no default shadcn theme, no emoji UI).

Compose the project middleware per SYSTEM_ARCHITECTURE §5/§7 and CLAUDE_RULES §5. This is the app-layer (second) RBAC layer; RLS remains primary.

middleware.ts must, in order:
1. Refresh the Supabase auth session (createServerClient with cookie get/set adapted to NextResponse), per @supabase/ssr middleware pattern.
2. Run next-intl locale handling (reuse the composable locale function from Task 0.5). Preserve locale prefix on redirects.
3. RBAC route guard for /[locale]/dashboard/*:
   - unauthenticated → redirect to /[locale]/login
   - role must match the dashboard segment: /dashboard/customer (customer), /dashboard/seller (seller), /dashboard/provider (provider), /dashboard/admin (admin). Wrong role → redirect to that user's own dashboard (or 403 page).
   - read role from the profiles row (server client) — do NOT trust a client-set cookie/claim for the role.
4. Export the matcher config to cover app routes but EXCLUDE _next, static assets, api/webhooks (Tap webhook must NOT be locale/auth gated).

Constraints: middleware must not leak the service-role key (uses anon + user session only). No `any`. Keep it small and composable. Document the matcher exclusions.

When done: typecheck + lint, and list manual test steps for each role redirect. Do not commit.
```

**Files:**
- `middleware.ts` (finalized), `lib/rbac.ts` (role→dashboard mapping helper)
- maybe `app/[locale]/403/page.tsx` or reuse a redirect

**Tests / verification:**
- Anon hitting `/ar/dashboard/seller` → redirected to `/ar/login`
- Customer hitting `/ar/dashboard/admin` → redirected to own dashboard / 403
- Correct role reaches its dashboard
- Webhook path excluded from matcher (not locale/auth gated)
- Locale prefix preserved through redirects

**DoD:**
- [ ] Session refresh works (no premature logout)
- [ ] Locale negotiation composed in, prefix preserved
- [ ] Role guard correct for all 4 dashboards; role read server-side from `profiles`
- [ ] Matcher excludes `_next`, static, `api/payments/webhook`
- [ ] typecheck + lint pass

**Suggested commit:** `feat(middleware): supabase session refresh + locale + rbac route guards`

---

## Task 0.7 — Auth feature: routes, forms, role redirect

**REQ-IDs:** REQ-AUTH-01 (register + role), REQ-AUTH-02 (login), REQ-AUTH-03 (roles), REQ-AUTH-04 (me/profile), REQ-AUTH-05 (pending state UX)

**Objective:** Implement the auth API routes per API_MAP, the login/register forms (react-hook-form + Zod), role-based redirect after login, and the "awaiting approval" state for seller/provider.

**Prompt:**
```
MANDATORY FIRST STEPS (do before writing any code):
1. Read docs/CLAUDE_RULES.md (engineering standards).
2. Read docs/DESIGN_RULES.md (single source of truth for all UI/UX).
3. Follow BOTH documents fully before writing any code.
4. Never violate any rule in either document (see DESIGN_RULES.md §17 Forbidden).
5. Keep the entire application visually consistent with the established design system
   (semantic color tokens only, typography scale, 8px spacing, defined radii/shadows,
   Lucide icons, RTL-correct logical properties, no default shadcn theme, no emoji UI).

Implement authentication per API_MAP Auth section, USER_FLOWS §1, COMPONENT_TREE (AuthCard/LoginForm/RegisterForm/RoleSelect), and CLAUDE_RULES.

Backend (Route Handlers, typed envelope { data } | { error:{code,message} }):
1. POST /api/auth/register — body Zod {email,password,full_name,role}. role ∈ {customer,seller,provider}. Create the Supabase auth user passing role in user metadata so the DB trigger sets status. Return {user, session}. Errors: 400 VALIDATION, 409 EMAIL_TAKEN.
2. POST /api/auth/login — {email,password} → {user, session}. 400, 401 INVALID_CREDENTIALS.
3. POST /api/auth/logout — clears session → {ok}. 401.
4. GET /api/auth/me — returns {profile} for the session user. 401.
Put validation schemas in features/auth/schema.ts; queries/mutations in features/auth/{queries,mutations}.ts.

Frontend (app/[locale]/(auth)/...):
5. login/page.tsx → AuthCard + LoginForm. On success, redirect by role: customer→/dashboard/customer, seller→/dashboard/seller, provider→/dashboard/provider, admin→/dashboard/admin.
6. register/page.tsx → AuthCard + RegisterForm + RoleSelect (customer/seller/provider only; admin not self-registerable).
7. For seller/provider after register: show an "awaiting admin approval" state — they are logged in but their dashboard shows a pending banner and listing actions are disabled (REQ-AUTH-05). Pull status from /api/auth/me.
8. All strings via messages/*. RTL correct. Loading/empty/error states + toast on failure.

Constraints: server-side Zod on every route; no `any`; reuse shadcn Form primitives; no hardcoded strings. Do not bypass the trigger by writing profiles directly from the client.

When done: typecheck + lint; add an auth unit test (schema validation) + an RLS smoke note. Report. Do not commit.
```

**Files:**
- `app/api/auth/register/route.ts`, `login/route.ts`, `logout/route.ts`, `me/route.ts`
- `features/auth/{schema.ts,queries.ts,mutations.ts,types.ts}`
- `app/[locale]/(auth)/login/page.tsx`, `register/page.tsx`, `(auth)/layout.tsx`
- `components/shared/AuthCard.tsx`, auth forms under `features/auth` or `components`
- `tests/unit/auth.schema.test.ts`

**Tests / verification:**
- Register customer → profile active → redirect to customer dashboard
- Register seller → profile pending → pending banner, listing disabled
- Login wrong password → 401 INVALID_CREDENTIALS toast
- `GET /api/auth/me` returns the right profile; 401 when logged out
- Auth schema unit test passes

**DoD:**
- [ ] All 4 auth routes match API_MAP contract + error codes
- [ ] Role-based redirect correct for all roles
- [ ] Seller/provider pending state enforced in UI (REQ-AUTH-05)
- [ ] Zod validation server-side; no `any`; strings via messages
- [ ] Unit test + typecheck + lint pass

**Suggested commit:** `feat(auth): register/login/logout/me routes, forms, role redirect, pending state`

---

## Task 0.8 — Provider abstractions: Payment (Tap stub) + Notification (Resend)

**REQ-IDs:** REQ-PAY-01 (create-intent abstraction), REQ-PAY-* (provider-agnostic), REQ-NOT-01 (email via Resend), C5 (provider-agnostic notifications), Future-scalability (Stripe/Twilio later)

**Objective:** Define the `PaymentProvider` interface with a Tap implementation (stub for now) and a `StripeProvider` stub; define `NotificationService` with a `ResendEmailChannel` and an `SmsChannel` interface placeholder. Feature code must never call Tap/Resend directly.

**Prompt:**
```
MANDATORY FIRST STEPS (do before writing any code):
1. Read docs/CLAUDE_RULES.md (engineering standards).
2. Read docs/DESIGN_RULES.md (single source of truth for all UI/UX).
3. Follow BOTH documents fully before writing any code.
4. Never violate any rule in either document (see DESIGN_RULES.md §17 Forbidden).
5. Keep the entire application visually consistent with the established design system
   (semantic color tokens only, typography scale, 8px spacing, defined radii/shadows,
   Lucide icons, RTL-correct logical properties, no default shadcn theme, no emoji UI).

Create the provider abstractions per SYSTEM_ARCHITECTURE §13/§15, PROJECT_ANALYSIS Recommended Decisions 3 & 5, Conflicts C5, and CLAUDE_RULES §3 (never call Tap/Resend directly from feature code).

Payments (lib/payments/):
1. PaymentProvider.ts — interface with at minimum: createIntent({ target, amount, currency, idempotencyKey }) => { intentId, clientToken, amount, currency }; verifyWebhook(req) => { event, verified }; (sketch capture handling). Use typed inputs/outputs; amounts in integer minor units.
2. tap.ts — TapProvider implementing the interface against the Tap sandbox. createIntent can be a thin real call OR a clearly-marked stub returning a sandbox token (Task 0.9 proves the real call). verifyWebhook signature-verifies using TAP_WEBHOOK_SECRET (implement signature check structure even if capture is finished in Phase 2).
3. stripe.ts — StripeProvider stub implementing the same interface, throwing NotImplemented. (Future scalability.)
4. index.ts — a factory returning the active provider (Tap) behind the interface, so feature code imports the interface, never TapProvider directly.

Notifications (lib/notifications/):
5. NotificationService.ts — interface send(template, to, data). Channel-agnostic.
6. resend.ts — ResendEmailChannel using RESEND_API_KEY; template keys: order_confirmed, booking_confirmed, payment_received, new_event_request, booking_reminder (stub bodies for now).
7. sms.ts — SmsChannel interface placeholder (Twilio Phase 2, C5) — no implementation, just the interface so it's ready.

Constraints: all secrets from env, server-only. No `any`. Integer minor units for money. Feature modules must depend on the interfaces, not concrete providers. Add a brief comment in each file naming the REQ-ID it serves.

When done: typecheck + lint; a unit test that the factory returns a PaymentProvider and Resend channel constructs. Report. Do not commit.
```

**Files:**
- `lib/payments/{PaymentProvider.ts,tap.ts,stripe.ts,index.ts}`
- `lib/notifications/{NotificationService.ts,resend.ts,sms.ts}`
- `lib/money.ts` (minimal integer-minor-unit helpers if not yet present)
- `tests/unit/providers.test.ts`

**Tests / verification:**
- Factory returns an object satisfying `PaymentProvider`
- `StripeProvider` throws `NotImplemented`
- `ResendEmailChannel` constructs with env key; `send` callable (mock)
- No feature file imports `tap.ts` / `resend.ts` directly (only via index/interface)

**DoD:**
- [ ] `PaymentProvider` interface + Tap impl + Stripe stub + factory
- [ ] `NotificationService` + Resend channel + SMS interface placeholder (C5)
- [ ] Webhook signature-verification structure present (uses `TAP_WEBHOOK_SECRET`)
- [ ] Money in integer minor units; no `any`
- [ ] Unit test + typecheck + lint pass

**Suggested commit:** `feat(providers): payment (tap)+notification (resend) abstractions, stripe/sms stubs`

---

## Task 0.9 — Tap sandbox spike (create-intent proof)

**REQ-IDs:** REQ-PAY-01 (create-intent), Known-Risk "Tap integration unknowns" (spike day 1)

**Objective:** Prove the Tap sandbox round-trip end to end: a minimal `create-intent` call through the `TapProvider` returns a valid sandbox token. This de-risks the entire Phase 2 payment core.

**Prompt:**
```
MANDATORY FIRST STEPS (do before writing any code):
1. Read docs/CLAUDE_RULES.md (engineering standards).
2. Read docs/DESIGN_RULES.md (single source of truth for all UI/UX).
3. Follow BOTH documents fully before writing any code.
4. Never violate any rule in either document (see DESIGN_RULES.md §17 Forbidden).
5. Keep the entire application visually consistent with the established design system
   (semantic color tokens only, typography scale, 8px spacing, defined radii/shadows,
   Lucide icons, RTL-correct logical properties, no default shadcn theme, no emoji UI).

Run the Tap sandbox spike per IMPLEMENTATION_PLAN Phase 0 (Tap sandbox proof) and PROJECT_ANALYSIS Known Risks (Tap unknowns).

Goal: prove a real create-intent round-trip against Tap sandbox using TapProvider from Task 0.8.

Do:
1. Implement TapProvider.createIntent to make the real Tap sandbox call (charge/authorize as appropriate for an upfront fee), using TAP_SECRET_KEY (sandbox). Amount in integer minor units, currency SAR or EGP.
2. Add a guarded dev-only route OR a script (scripts/tap-spike.ts) that calls createIntent with a tiny sandbox amount and prints { intentId, clientToken }. The route, if used, must be dev-guarded and NOT shipped to production.
3. Document the exact Tap sandbox response shape observed (fields we'll rely on in Phase 2: charge id, status, redirect/token), so the webhook in Phase 2 can be built against reality.
4. Note any Tap-specific gotchas discovered (mada specifics, redirect flow, 3DS) in a short SPIKE_NOTES section appended to docs or a comment block.

Constraints: sandbox only; never log secrets; do not commit real keys. No `any`. This is a spike — keep it isolated so it doesn't pollute the Phase 2 implementation, but record findings.

When done: report the sandbox token result and the observed response shape. Do not commit.
```

**Files:**
- `lib/payments/tap.ts` (real `createIntent`)
- `scripts/tap-spike.ts` (or a dev-guarded route)
- `docs/SPIKE_NOTES.md` (Tap findings)

**Tests / verification:**
- Running the spike returns a non-empty `intentId` + `clientToken` from Tap sandbox
- Response shape documented for Phase 2 webhook work
- No secrets logged; spike not reachable in production

**DoD:**
- [ ] Real Tap sandbox `create-intent` returns a token
- [ ] Observed response shape recorded in `SPIKE_NOTES`
- [ ] Spike isolated + dev-guarded; no secret leakage
- [ ] typecheck + lint pass

**Suggested commit:** `chore(spike): tap sandbox create-intent proof + response-shape notes`

---

## Task 0.10 — Shared primitives: Navbar / Footer / LocaleSwitcher / RoleGuard

**REQ-IDs:** REQ-NFR-07 (bilingual nav), REQ-NFR-08 (feminine polish), REQ-NFR-03 (RoleGuard defense-in-depth)

**Objective:** Build the cross-cutting shell components referenced everywhere later: `Navbar`, `Footer`, `LocaleSwitcher`, `RoleGuard`, plus `EmptyState`/`LoadingState` so every async view has them from day one.

**Prompt:**
```
MANDATORY FIRST STEPS (do before writing any code):
1. Read docs/CLAUDE_RULES.md (engineering standards).
2. Read docs/DESIGN_RULES.md (single source of truth for all UI/UX).
3. Follow BOTH documents fully before writing any code.
4. Never violate any rule in either document (see DESIGN_RULES.md §17 Forbidden).
5. Keep the entire application visually consistent with the established design system
   (semantic color tokens only, typography scale, 8px spacing, defined radii/shadows,
   Lucide icons, RTL-correct logical properties, no default shadcn theme, no emoji UI).

Build shared shell components per COMPONENT_TREE §3/§8 and CLAUDE_RULES §2 (reuse-first) / §7 (RTL, a11y).

Create under components/shared:
1. Navbar — logo, category links (home, products, rentals, services, Event Planners), search slot, cart badge (placeholder count for now), LocaleSwitcher, auth menu (login/register when logged out; dashboard/logout when logged in, role-aware label). All labels from messages/*. RTL correct (logical start/end).
2. MobileNav — shadcn Sheet variant of Navbar for small screens (REQ-NFR-02).
3. Footer — links + locale-aware content from messages.
4. LocaleSwitcher — toggles /ar ↔ /en preserving the current path.
5. RoleGuard — client/server guard component that renders children only if the session role matches an allowed list; otherwise renders an EmptyState/redirect. This is the app-layer companion to middleware + RLS (defense-in-depth, REQ-NFR-03).
6. EmptyState + LoadingState — generic, reused by every async view (loading/empty/error states are mandatory per CLAUDE_RULES §7).

Wire Navbar + Footer into app/[locale]/layout.tsx (or the marketing layout) so the landing page shows them.

Constraints: server components by default; 'use client' only for interactive bits (LocaleSwitcher, MobileNav, auth menu). a11y: keyboard nav + ARIA + focus. No hardcoded strings. No `any`. Reuse shadcn primitives — do not hand-roll buttons/sheets.

When done: typecheck + lint; confirm RTL + mobile nav render. Report. Do not commit.
```

**Files:**
- `components/shared/{Navbar.tsx,MobileNav.tsx,Footer.tsx,LocaleSwitcher.tsx,RoleGuard.tsx,EmptyState.tsx,LoadingState.tsx}`
- `app/[locale]/layout.tsx` (wire Navbar/Footer)
- `messages/{ar,en}.json` (nav/footer keys)

**Tests / verification:**
- Navbar renders RTL in `/ar`, LTR in `/en`; locale switch preserves path
- MobileNav opens on small viewport
- `RoleGuard` blocks wrong-role children
- Keyboard nav + ARIA present (basic a11y check)

**DoD:**
- [ ] Navbar/Footer/LocaleSwitcher/RoleGuard/Empty+Loading built and reused-ready
- [ ] All strings via messages; RTL + a11y correct
- [ ] `'use client'` only where interactive
- [ ] typecheck + lint pass

**Suggested commit:** `feat(shared): navbar, footer, locale switcher, role guard, empty/loading states`

---

## Task 0.11 — Phase DoD gate: deploy, typecheck/lint, RLS smoke, matrix reconcile

**REQ-IDs:** Phase 0 DoD; REQ-NFR-05 (RLS deny-by-default verified); REQ-NFR-01 (Vercel deploy)

**Objective:** Close the phase: green Vercel preview, passing typecheck/lint, an RLS smoke test proving deny-by-default, the foundational auth unit/RLS tests, and a reconciled `REQUIREMENTS_MATRIX.md`.

**Prompt:**
```
MANDATORY FIRST STEPS (do before writing any code):
1. Read docs/CLAUDE_RULES.md (engineering standards).
2. Read docs/DESIGN_RULES.md (single source of truth for all UI/UX).
3. Follow BOTH documents fully before writing any code.
4. Never violate any rule in either document (see DESIGN_RULES.md §17 Forbidden).
5. Keep the entire application visually consistent with the established design system
   (semantic color tokens only, typography scale, 8px spacing, defined radii/shadows,
   Lucide icons, RTL-correct logical properties, no default shadcn theme, no emoji UI).

Close Phase 0 to its Definition of Done per IMPLEMENTATION_PLAN Phase 0 and CLAUDE_RULES §0/§11/§12.

Do:
1. Ensure `pnpm typecheck` and `pnpm lint` are clean across the whole project; fix anything outstanding.
2. Auth unit tests (schema/validation) and an RLS smoke test: as anon, attempting to read another user's profiles row is denied; settings are readable; profiles self-read works after auth. Put RLS smoke in tests/integration.
3. Configure Vercel: connect repo, set all env vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, TAP_SECRET_KEY, TAP_WEBHOOK_SECRET, RESEND_API_KEY, NEXT_PUBLIC_APP_URL), and produce a green preview deploy. Confirm /ar (RTL) and /en render, login/register work, role redirect works.
4. Apply migrations 0001 + 0002 to the linked Supabase; regenerate database.types.ts and ensure it's committed.
5. Update REQUIREMENTS_MATRIX.md: mark every Phase-0 REQ-ID (REQ-AUTH-01..05, REQ-NFR-01/02/03/05/07/08, REQ-PAY-01, REQ-PAY-06, REQ-NOT-01) as built or explicitly deferred with a reason. Never silently skip.
6. Produce a short Phase 0 acceptance report: what passes, what's deferred, any surfaced conflicts.

Constraints: do NOT deploy to production or run real payments/emails without explicit go-ahead (CLAUDE_RULES §12) — Vercel PREVIEW only. Report the preview URL.

When done: report typecheck/lint/test results, preview URL, and the matrix diff. Then (only if I confirm) commit the full phase.
```

**Files:**
- `tests/integration/rls.smoke.test.ts`, `tests/unit/*` (finalize)
- `REQUIREMENTS_MATRIX.md` (status column updated)
- `vercel.json` (if needed), CI config (lint/typecheck/test gate)
- `docs/PHASE_0_ACCEPTANCE.md`

**Tests / verification:**
- `typecheck` + `lint` + unit + integration all green
- RLS smoke proves deny-by-default on non-owned `profiles` row
- Vercel **preview** deploy green; `/ar` RTL + `/en` render; auth + role redirect work end to end
- Migrations applied; `database.types.ts` current

**DoD (Phase gate):**
- [ ] Deploys green to Vercel **preview**
- [ ] typecheck + lint pass
- [ ] RLS deny-by-default verified by test
- [ ] AR RTL renders; register/login + role redirect work; Tap sandbox returned a token (Task 0.9)
- [ ] Matrix reconciled: all Phase-0 REQ-IDs built or explicitly deferred
- [ ] Phase acceptance report written

**Suggested commit (whole phase, only on confirmation):**
`chore(foundation): scaffold next14+supabase, auth, rbac, i18n, tap spike`

---

## Phase 0 → Phase 1 handoff checklist

Before starting Phase 1 (Catalog & Storage), confirm:

- [ ] `profiles` + trigger + RLS live; roles/status correct
- [ ] `platform_settings` seeded (commission + per-category/currency fees, minor units)
- [ ] Supabase `client`/`server`/`admin` clients in place; `database.types.ts` generated
- [ ] Middleware (session + locale + RBAC) guarding dashboards
- [ ] Auth flows working with role redirect + pending state
- [ ] Payment + Notification provider abstractions ready (feature code never calls Tap/Resend directly)
- [ ] Tap sandbox proven; response shape documented for the Phase 2 webhook
- [ ] Shared shell (Navbar/Footer/LocaleSwitcher/RoleGuard/Empty/Loading) reuse-ready
- [ ] RTL/AR + a11y baseline holding on every page built so far
- [ ] `REQUIREMENTS_MATRIX.md` current
