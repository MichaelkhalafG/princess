# E2E tests (Playwright)

Auth end-to-end suite (Task 0.7), pulled forward from Phase 6. Replaces hand-testing
the auth flows in the browser. Runs every spec in **both locales** via the `ar`
(RTL) and `en` (LTR) projects.

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

This boots `pnpm dev` automatically (port 3000), waits for it, runs all 16 tests
(8 × 2 locales), then stops. Useful variants:

```bash
pnpm test:e2e --project=ar          # one locale only
pnpm test:e2e --headed              # watch it drive the browser
pnpm exec playwright show-report    # open the HTML report after a run
```

## What green looks like

```
Running 16 tests using 1 worker
  ✓  [ar] › auth flows › customer registration lands on the customer dashboard with no pending banner
  ✓  [ar] › auth flows › seller registration shows the pending-approval banner
  ✓  [ar] › auth flows › provider registration shows the pending-approval banner
  ✓  [ar] › auth flows › a registered customer can log in
  ✓  [ar] › auth flows › login with a wrong password shows an error and does not sign in
  ✓  [ar] › auth flows › registering a duplicate email shows EMAIL_TAKEN
  ✓  [ar] › auth page rendering › renders the correct direction and localized copy
  ✓  [ar] › auth page rendering › auth pages have no uncaught errors or console errors
  ✓  [en] › ... (same eight)
  16 passed
```

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
