import { defineConfig, devices } from "@playwright/test";

import type { AuthOptions } from "./tests/e2e/fixtures";

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

/**
 * Playwright E2E (pulled forward from Phase 6, scoped to auth for now).
 *
 * `webServer` boots the app itself via `pnpm dev`, so `pnpm test:e2e` is the
 * single command — no manual server start. Two projects run every spec in both
 * locales (ar = RTL, en = LTR). Serial (`workers: 1`) for first-run reliability
 * against a single dev server compiling routes on demand.
 *
 * Prerequisite: in Supabase Auth settings, **"Confirm email" must be OFF** so
 * registration returns a session and the flow redirects to the dashboard
 * (otherwise the app correctly routes to "check your email" — see README note
 * in tests/e2e/auth.spec.ts).
 */
export default defineConfig<AuthOptions>({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 45_000,
    actionTimeout: 20_000,
  },
  projects: [
    { name: "ar", use: { ...devices["Desktop Chrome"], appLocale: "ar" } },
    { name: "en", use: { ...devices["Desktop Chrome"], appLocale: "en" } },
  ],
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
  },
});
