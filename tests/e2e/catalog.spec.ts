import { expect, test, TEST_PASSWORD, uniqueEmail } from "./fixtures";
import { cleanupSeller, createActiveSeller, SELLER_ENABLED } from "./seller";

/**
 * Catalog E2E (Task 1.8 — Phase 1 DoD). Extends the Phase-0 harness so the public
 * browse/filter/sort/detail flow and the seller add-with-image flow are verified
 * by one command (`pnpm test:e2e`) instead of by hand. Runs in both locales via
 * the `ar` (RTL) and `en` (LTR) projects.
 *
 * Two groups:
 *  - PUBLIC (always on): resilient to an empty catalog — structural assertions
 *    (render, RTL, filter→URL, no console errors); the detail click-through runs
 *    only when at least one active product exists.
 *  - SELLER (opt-in, `E2E_SELLER=1` + service-role key): seeds an approved seller
 *    via service-role (no anon path to an active seller — RLS blocks escalation),
 *    drives add-product-with-image through the UI, asserts it lands in the manager
 *    and on the public list, then tears the seller (+ storage) down.
 *
 * PREREQUISITE (shared with auth.spec): Supabase Auth "Confirm email" OFF.
 * The `products` Storage bucket must exist (supabase/storage/products_bucket.sql).
 */

const SAMPLE_IMAGE = "tests/e2e/fixtures/sample-product.png";
const PRODUCT_UUID = /\/products\/[0-9a-f-]{36}$/;

test.describe("catalog browsing (public)", () => {
  test("renders /products with the correct direction and localized title", async ({
    page,
    appLocale,
    messages,
  }) => {
    await page.goto(`/${appLocale}/products`);

    const dir = appLocale === "ar" ? "rtl" : "ltr";
    await expect(page.locator("html")).toHaveAttribute("dir", dir);
    await expect(page.locator("html")).toHaveAttribute("lang", appLocale);
    await expect(page.getByRole("heading", { level: 1, name: messages.products.title })).toBeVisible();
    await expect(page.getByTestId("filter-bar")).toBeVisible();
  });

  test("filters and sort write to the URL (single source of truth)", async ({ page, appLocale, messages }) => {
    await page.goto(`/${appLocale}/products`);
    const bar = page.getByTestId("filter-bar");

    // Category — pick the first real option (index 0 is "All categories"), when seeded.
    await bar.getByTestId("filter-category").click();
    const options = page.getByRole("option");
    if ((await options.count()) > 1) {
      await options.nth(1).click();
      await expect(page).toHaveURL(/[?&]category=/);
    } else {
      await page.keyboard.press("Escape");
    }

    // Min price — debounced (300ms); the default expect timeout absorbs it.
    await bar.getByTestId("filter-min-price").fill("50");
    await expect(page).toHaveURL(/[?&]minPrice=50/);

    // Sort — static options; assert the URL reflects the chosen value.
    await bar.getByTestId("filter-sort").click();
    await page.getByRole("option", { name: messages.filters.sort.price_asc }).click();
    await expect(page).toHaveURL(/[?&]sort=price_asc/);
  });

  test("opens a product detail page when an active product exists", async ({ page, appLocale }) => {
    await page.goto(`/${appLocale}/products`);

    const cards = page.getByTestId("product-card");
    const count = await cards.count();
    test.skip(count === 0, "no active products seeded — detail click-through covered by the seller flow");

    await cards.first().click();
    await expect(page).toHaveURL(PRODUCT_UUID);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("the catalog pages have no uncaught or console errors", async ({ page, appLocale }) => {
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      const url = msg.location().url;
      // Ignore benign resource 404s (favicon, missing images on seed-less DBs).
      if (/favicon/i.test(url) || /failed to load resource/i.test(text)) return;
      problems.push(`console.error: ${text}`);
    });

    await page.goto(`/${appLocale}/products`);
    await expect(page.getByTestId("filter-bar")).toBeVisible();

    const cards = page.getByTestId("product-card");
    if ((await cards.count()) > 0) {
      await cards.first().click();
      await expect(page).toHaveURL(PRODUCT_UUID);
    }

    expect(problems, problems.join("\n")).toEqual([]);
  });
});

test.describe("seller adds a product (opt-in)", () => {
  let seededSellerId: string | null = null;

  test.afterEach(async () => {
    if (seededSellerId) {
      await cleanupSeller(seededSellerId);
      seededSellerId = null;
    }
  });

  test("seller logs in, adds a product with an image, and it appears in the manager and on /products", async ({
    page,
    appLocale,
    messages,
  }) => {
    test.skip(!SELLER_ENABLED, "set E2E_SELLER=1 and the service-role key to run the seller flow");

    const seller = await createActiveSeller(uniqueEmail(appLocale));
    seededSellerId = seller.id;

    // Log in through the UI → active seller lands on the seller dashboard.
    await page.goto(`/${appLocale}/login`);
    await page.getByTestId("login-email").fill(seller.email);
    await page.getByTestId("login-password").fill(TEST_PASSWORD);
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(new RegExp(`/${appLocale}/dashboard/seller$`));
    await expect(page.getByTestId("product-manager")).toBeVisible();

    // Open the form and fill it.
    const title = `E2E Product ${Date.now()}`;
    await page.getByTestId("add-product").click();
    await expect(page.getByTestId("product-form")).toBeVisible();
    await page.getByTestId("product-title").fill(title);
    await page.getByTestId("product-price").fill("199");
    await page.getByTestId("product-stock").fill("5");

    // Status → active (so it is publicly listed).
    await page.getByTestId("product-status").click();
    await page.getByRole("option", { name: messages.status.active }).click();

    // Upload an image (real /api/upload → Supabase Storage, RLS-scoped to the seller).
    await page.getByTestId("image-uploader-input").setInputFiles(SAMPLE_IMAGE);
    await expect(page.getByTestId("image-uploader").getByRole("img").first()).toBeVisible();

    // Submit → manager refreshes and shows the new product.
    await page.getByTestId("product-submit").click();
    await expect(page.getByTestId("product-manager").getByText(title)).toBeVisible();

    // It is now publicly listed (createProduct revalidates the `products` tag).
    await page.goto(`/${appLocale}/products`);
    await expect(page.getByText(title)).toBeVisible();
  });
});
