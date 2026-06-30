# E2E tests (Playwright)

Auth (Task 0.7) + catalog (Task 1.8) end-to-end suites, pulled forward from Phase 6.
Replaces hand-testing the flows in the browser. Runs every spec in **both locales**
via the `ar` (RTL) and `en` (LTR) projects.

- `auth.spec.ts` — registration, login, role redirect, pending banner, errors (8 × 2).
- `catalog.spec.ts` — **public** browse/filter/sort/detail + no-console-errors (always
  on, empty-catalog-safe) and an **opt-in seller** add-product-with-image flow.

## One-time setup

```bash
pnpm install                      # picks up @playwright/test
pnpm exec playwright install chromium   # downloads the browser (not done by pnpm install)
```

You also need the app's `.env.local` (Supabase URL + anon key) in place — the suite
starts the app itself with `pnpm dev`.

### ⚠️ Required Supabase setting

In the Supabase dashboard: **Authentication → Providers → Email → turn "Confirm email" OFF.**

With confirmation ON, `signUp` returns no session, so the app correctly routes to a
"check your email" state instead of the dashboard — and the register-success specs
would (correctly) not see a dashboard. Turn it off for E2E (and dev).

## Run

```bash
pnpm test:e2e
```

This boots `pnpm dev` automatically (port 3000), waits for it, runs the suite, then
stops. Useful variants:

```bash
pnpm test:e2e --project=ar          # one locale only
pnpm test:e2e --headed              # watch it drive the browser
pnpm test:e2e catalog               # just the catalog spec
pnpm exec playwright show-report    # open the HTML report after a run
```

### Opt-in seller flow (`catalog.spec.ts`)

The seller add-product test needs an **approved** seller. Registration creates
sellers as `pending`, and promoting to `active` is correctly blocked by RLS — so
there is no anon-key path to an active seller. The test therefore seeds one via the
**service-role key**, used server-side only inside the trusted test process. It is
**opt-in**: it runs only when `E2E_SELLER=1` and the service-role key are present;
otherwise it is skipped and the public catalog tests still run.

```bash
# .env.local must have SUPABASE_SERVICE_ROLE_KEY; the products bucket must exist.
E2E_SELLER=1 pnpm test:e2e catalog
```

It uploads a real image to Supabase Storage (`tests/e2e/fixtures/sample-product.png`),
then tears the seeded seller down (storage objects + auth user, which cascades the
product) in `afterEach`. The seller's email also matches the `@e2e.princess.test`
cleanup key below as a backstop.

## What green looks like

Without the seller opt-in, the catalog spec contributes 4 tests/locale and the
seller flow shows as skipped:

```
Running 24 tests using 1 worker
  ✓  [ar] › auth flows › ... (6)
  ✓  [ar] › auth page rendering › ... (2)
  ✓  [ar] › catalog browsing (public) › renders /products with the correct direction and localized title
  ✓  [ar] › catalog browsing (public) › filters and sort write to the URL (single source of truth)
  ✓  [ar] › catalog browsing (public) › opens a product detail page when an active product exists
  ✓  [ar] › catalog browsing (public) › the catalog pages have no uncaught or console errors
  -  [ar] › seller adds a product (opt-in) › ... (skipped: set E2E_SELLER=1)
  ✓  [en] › ... (same)
  24 passed (2 skipped)
```

With `E2E_SELLER=1` the two seller tests also pass → **26 passed**. The detail
click-through self-skips when the catalog has no active products (so a fresh DB is
still green); run the seller flow, or seed a product, to exercise it.

Traces/screenshots are captured **only on failure** (`playwright-report/`,
`test-results/`); on a clean run there's nothing to inspect.

## Created users + teardown (run this yourself)

Each run creates real Supabase auth users with **unique** emails
(`e2e-<locale>-<timestamp>-<rand>@e2e.princess.test`), so reruns never collide on
`EMAIL_TAKEN`. They are **not** auto-deleted: cleanup would require the
service-role key inside the test runner, which (a) isn't wired up yet and (b) we
keep out of the test process on purpose. So clean up with one query when you like —
deleting from `auth.users` cascades to `public.profiles`:

```sql
delete from auth.users where email like '%@e2e.princess.test';
```

(Optional sanity check first: `select email from auth.users where email like '%@e2e.princess.test';`)
