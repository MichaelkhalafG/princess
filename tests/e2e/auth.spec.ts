import type { Page } from "@playwright/test";

import type { RegisterRole } from "@/features/auth/schema";
import {
  type AppLocale,
  type AuthMessages,
  expect,
  test,
  TEST_PASSWORD,
  uniqueEmail,
} from "./fixtures";

/**
 * Auth E2E (Task 0.7) — replaces hand-testing the auth flows in the browser.
 *
 * PREREQUISITE: Supabase Auth → Providers → Email → **"Confirm email" OFF**.
 * With it ON, registration returns no session and the app routes to
 * "check your email" instead of the dashboard (by design), and the
 * register-success tests below would fail. Teardown SQL is in
 * tests/integration/auth.rls-smoke.md / the report (created users persist).
 *
 * Runs in both locales via the `ar` and `en` projects (see playwright.config.ts).
 * Selectors use stable data-testids; asserted copy is read from messages/* so no
 * UI string is hardcoded here.
 */

const dashboardUrl = (locale: AppLocale, role: string) =>
  new RegExp(`/${locale}/dashboard/${role}$`);
const loginUrl = (locale: AppLocale) => new RegExp(`/${locale}/login$`);
const registerUrl = (locale: AppLocale) => new RegExp(`/${locale}/register$`);

/** Fill and submit the registration form (does not assert the outcome). */
async function fillRegister(
  page: Page,
  locale: AppLocale,
  messages: AuthMessages,
  input: { email: string; role: RegisterRole },
): Promise<void> {
  await page.goto(`/${locale}/register`);
  await page.getByTestId("register-name").fill("E2E User");
  await page.getByTestId("register-email").fill(input.email);
  await page.getByTestId("register-password").fill(TEST_PASSWORD);
  await page.getByTestId("register-role").click();
  await page.getByRole("option", { name: messages.auth.roles[input.role].label }).click();
  await page.getByTestId("register-submit").click();
}

/** Log in via the UI (does not assert the outcome). */
async function fillLogin(page: Page, locale: AppLocale, email: string, password: string): Promise<void> {
  await page.goto(`/${locale}/login`);
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
}

test.describe("auth flows", () => {
  test("customer registration lands on the customer dashboard with no pending banner", async ({
    page,
    appLocale,
    messages,
  }) => {
    await fillRegister(page, appLocale, messages, { email: uniqueEmail(appLocale), role: "customer" });

    await expect(page).toHaveURL(dashboardUrl(appLocale, "customer"));
    // Confirm the dashboard actually rendered before asserting the banner is absent.
    await expect(page.getByTestId("logout-button")).toBeVisible();
    await expect(page.getByTestId("pending-banner")).toHaveCount(0);
  });

  test("seller registration shows the pending-approval banner", async ({
    page,
    appLocale,
    messages,
  }) => {
    await fillRegister(page, appLocale, messages, { email: uniqueEmail(appLocale), role: "seller" });

    await expect(page).toHaveURL(dashboardUrl(appLocale, "seller"));
    await expect(page.getByTestId("pending-banner")).toBeVisible();
    await expect(page.getByText(messages.auth.pending.title)).toBeVisible();
  });

  test("provider registration shows the pending-approval banner", async ({
    page,
    appLocale,
    messages,
  }) => {
    await fillRegister(page, appLocale, messages, {
      email: uniqueEmail(appLocale),
      role: "provider",
    });

    await expect(page).toHaveURL(dashboardUrl(appLocale, "provider"));
    await expect(page.getByTestId("pending-banner")).toBeVisible();
  });

  test("a registered customer can log in", async ({ page, appLocale, messages }) => {
    const email = uniqueEmail(appLocale);
    await fillRegister(page, appLocale, messages, { email, role: "customer" });
    await expect(page).toHaveURL(dashboardUrl(appLocale, "customer"));

    await page.getByTestId("logout-button").click();
    await expect(page).toHaveURL(loginUrl(appLocale));

    await fillLogin(page, appLocale, email, TEST_PASSWORD);
    await expect(page).toHaveURL(dashboardUrl(appLocale, "customer"));
  });

  test("login with a wrong password shows an error and does not sign in", async ({
    page,
    appLocale,
    messages,
  }) => {
    const email = uniqueEmail(appLocale);
    await fillRegister(page, appLocale, messages, { email, role: "customer" });
    await expect(page).toHaveURL(dashboardUrl(appLocale, "customer"));
    await page.getByTestId("logout-button").click();
    await expect(page).toHaveURL(loginUrl(appLocale));

    await fillLogin(page, appLocale, email, "wrong-password-123");

    // Target the visible toast (not Radix's hidden aria-live announce region,
    // which also contains the text) so the match is unambiguous.
    const toast = page.getByTestId("toast");
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(messages.auth.errors.INVALID_CREDENTIALS);
    await expect(page).toHaveURL(loginUrl(appLocale));
  });

  test("registering a duplicate email shows EMAIL_TAKEN", async ({ page, appLocale, messages }) => {
    const email = uniqueEmail(appLocale);
    await fillRegister(page, appLocale, messages, { email, role: "customer" });
    await expect(page).toHaveURL(dashboardUrl(appLocale, "customer"));
    await page.getByTestId("logout-button").click();
    await expect(page).toHaveURL(loginUrl(appLocale));

    // Same email again → blocked.
    await fillRegister(page, appLocale, messages, { email, role: "customer" });

    const toast = page.getByTestId("toast");
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(messages.auth.errors.EMAIL_TAKEN);
    await expect(page).toHaveURL(registerUrl(appLocale));
  });
});

test.describe("auth page rendering", () => {
  test("renders the correct direction and localized copy", async ({ page, appLocale, messages }) => {
    await page.goto(`/${appLocale}/login`);

    const dir = appLocale === "ar" ? "rtl" : "ltr";
    await expect(page.locator("html")).toHaveAttribute("dir", dir);
    await expect(page.locator("html")).toHaveAttribute("lang", appLocale);

    // Subtitle is unique per locale (title and submit share text in Arabic).
    await expect(page.getByText(messages.auth.login.subtitle)).toBeVisible();
    await expect(page.getByTestId("login-submit")).toContainText(messages.auth.login.submit);
  });

  test("auth pages have no uncaught errors or console errors", async ({ page, appLocale }) => {
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      const url = msg.location().url;
      // Ignore benign resource 404s (e.g. /favicon.ico — its URL is in location(),
      // not the text). Real JS/render errors arrive via `pageerror` or as
      // descriptive console errors (incl. the missing-html-tags regression).
      if (/favicon/i.test(url) || /failed to load resource/i.test(text)) return;
      problems.push(`console.error: ${text}`);
    });

    for (const path of [`/${appLocale}/login`, `/${appLocale}/register`]) {
      await page.goto(path);
      // If the "missing required html tags" regression returned, the page would
      // not render our content and Next would log a console error — both caught.
      await expect(page.locator("html")).toHaveAttribute("lang", appLocale);
      const testid = path.endsWith("/login") ? "login-submit" : "register-submit";
      await expect(page.getByTestId(testid)).toBeVisible();
    }

    expect(problems, problems.join("\n")).toEqual([]);
  });
});
