import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { queryProductDetail, queryProductList } from "@/features/catalog/queries";
import { productFiltersSchema } from "@/features/catalog/schema";
import type { Database, TablesInsert } from "@/lib/database.types";

/**
 * Market-isolation integration test (Task 1.5.3 DoD; CR-01 §A, REQ-MKT-01/03) — the
 * definitive proof that R3 (cross-market leak) is CLOSED. It asserts directly against
 * the exported query CHOKE-POINT (`queryProductList` / `queryProductDetail` in
 * features/catalog/queries.ts), driven by an anon client (RLS active — the browser's
 * exact path), so it verifies the single place the market filter lives, not just RLS.
 *
 * Self-contained (does NOT rely on the dev seed): service-role setup creates a
 * dedicated category + three sellers (SA-only, EG-only, both) each with an active,
 * per-market-priced product; the anon assertions then prove an EG visitor never sees a
 * SA-only product (and vice-versa), a both-market product re-prices per market, and an
 * out-of-market deep link resolves to the DC-2 soft state — never leaking another
 * market's numbers. Teardown removes every fixture.
 *
 * OPT-IN: runs only when `MARKET_TEST=1` AND the Supabase URL + SERVICE ROLE key are
 * present (setup needs to create users + approved vendor_markets). Created users use
 * `@market-test.princess.test`.  Run: add `MARKET_TEST=1` to `.env.local`, then
 * `pnpm test markets-isolation`.
 */
function loadEnvLocal(): void {
  let content: string;
  try {
    content = readFileSync(".env.local", "utf8");
  } catch {
    return;
  }
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ENABLED = process.env.MARKET_TEST === "1" && SUPABASE_URL !== "" && SERVICE_ROLE_KEY !== "" && ANON_KEY !== "";

const admin = (): SupabaseClient<Database> =>
  createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
const anon = (): SupabaseClient<Database> =>
  createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

const PASSWORD = "Princess12345";
const DOMAIN = "@market-test.princess.test";
// Distinct prices per market so we can assert the RIGHT currency/amount is returned.
const EG_PRICE = 1200; // EGP
const SA_PRICE = 250; // SAR

const filtersFor = (categoryId: string) =>
  productFiltersSchema.parse({ category: categoryId, limit: "60" });

describe.skipIf(!ENABLED)("Market isolation — the query choke-point (live, anon)", () => {
  const db = admin();
  const stamp = Date.now();
  const sellerIds: string[] = [];
  let categoryId = "";
  let productSaOnly = "";
  let productEgOnly = "";
  let productBoth = "";

  // Creating a Supabase auth user is a network round-trip; the 3 are independent so we
  // create them in parallel. profiles is promoted to an active seller after signup.
  async function createSeller(suffix: string): Promise<string> {
    const { data, error } = await db.auth.admin.createUser({
      email: `mkt-${suffix}-${stamp}${DOMAIN}`,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { role: "seller", full_name: `Market Test ${suffix}` },
    });
    if (error || !data.user) throw new Error(`create seller ${suffix} failed: ${error?.message}`);
    const id = data.user.id;
    await db.from("profiles").update({ role: "seller", status: "active" }).eq("id", id);
    return id;
  }

  // Remote-DB fixture setup does several network round-trips; the default 10s hook
  // timeout is too tight, so raise it and BATCH the inserts (one call each for markets,
  // products, prices; sellers created in parallel) to keep setup well under it.
  beforeAll(async () => {
    const { data: category, error } = await db
      .from("categories")
      .insert({ kind: "product", name_ar: "اختبار السوق", name_en: "Market Test", slug: `mkt-test-${stamp}` })
      .select("id")
      .single();
    if (error || !category) throw new Error(`create category failed: ${error?.message}`);
    categoryId = category.id;

    const [sellerSa, sellerEg, sellerBoth] = await Promise.all([
      createSeller("sa"),
      createSeller("eg"),
      createSeller("both"),
    ]);
    sellerIds.push(sellerSa, sellerEg, sellerBoth);

    // One batched upsert of every approved market (service-role bypasses no-self-approve).
    const marketRows: TablesInsert<"vendor_markets">[] = [
      { vendor_id: sellerSa, market: "SA", is_approved: true },
      { vendor_id: sellerEg, market: "EG", is_approved: true },
      { vendor_id: sellerBoth, market: "EG", is_approved: true },
      { vendor_id: sellerBoth, market: "SA", is_approved: true },
    ];
    const { error: marketError } = await db
      .from("vendor_markets")
      .upsert(marketRows, { onConflict: "vendor_id,market" });
    if (marketError) throw new Error(`approve markets failed: ${marketError.message}`);

    // Client-side ids so products + their prices can each go in a single insert.
    productSaOnly = randomUUID();
    productEgOnly = randomUUID();
    productBoth = randomUUID();
    const productRows: TablesInsert<"products">[] = [
      { id: productSaOnly, seller_id: sellerSa, category_id: categoryId, title: "SA Only Product", status: "active" },
      { id: productEgOnly, seller_id: sellerEg, category_id: categoryId, title: "EG Only Product", status: "active" },
      { id: productBoth, seller_id: sellerBoth, category_id: categoryId, title: "Both Markets Product", status: "active" },
    ];
    const { error: productError } = await db.from("products").insert(productRows);
    if (productError) throw new Error(`create products failed: ${productError.message}`);

    const priceRows: TablesInsert<"product_prices">[] = [
      { product_id: productSaOnly, market: "SA", currency: "SAR", price: SA_PRICE, is_available: true },
      { product_id: productEgOnly, market: "EG", currency: "EGP", price: EG_PRICE, is_available: true },
      { product_id: productBoth, market: "EG", currency: "EGP", price: EG_PRICE, is_available: true },
      { product_id: productBoth, market: "SA", currency: "SAR", price: SA_PRICE, is_available: true },
    ];
    const { error: priceError } = await db.from("product_prices").insert(priceRows);
    if (priceError) throw new Error(`price products failed: ${priceError.message}`);
  }, 60000);

  afterAll(async () => {
    // Deleting the auth users cascades their products → prices; run in parallel.
    await Promise.all(sellerIds.map((id) => db.auth.admin.deleteUser(id)));
    if (categoryId) await db.from("categories").delete().eq("id", categoryId);
  }, 60000);

  it("EG list: shows EG-only + both, never the SA-only product, never a SAR number", async () => {
    const { items } = await queryProductList(anon(), filtersFor(categoryId), "EG");
    const ids = items.map((item) => item.id);
    expect(ids).toContain(productEgOnly);
    expect(ids).toContain(productBoth);
    expect(ids).not.toContain(productSaOnly);
    expect(items.every((item) => item.currency === "EGP")).toBe(true);
    expect(items.every((item) => item.market === "EG")).toBe(true);
  });

  it("SA list: shows SA-only + both, never the EG-only product, never an EGP number", async () => {
    const { items } = await queryProductList(anon(), filtersFor(categoryId), "SA");
    const ids = items.map((item) => item.id);
    expect(ids).toContain(productSaOnly);
    expect(ids).toContain(productBoth);
    expect(ids).not.toContain(productEgOnly);
    expect(items.every((item) => item.currency === "SAR")).toBe(true);
  });

  it("both-market product re-prices per market (EGP under EG, SAR under SA — never both)", async () => {
    const egList = await queryProductList(anon(), filtersFor(categoryId), "EG");
    const saList = await queryProductList(anon(), filtersFor(categoryId), "SA");
    const egRow = egList.items.find((item) => item.id === productBoth);
    const saRow = saList.items.find((item) => item.id === productBoth);
    expect(egRow?.currency).toBe("EGP");
    expect(egRow?.price).toBe(EG_PRICE);
    expect(saRow?.currency).toBe("SAR");
    expect(saRow?.price).toBe(SA_PRICE);
  });

  it("detail: an in-market product resolves ok with the market's currency", async () => {
    const result = await queryProductDetail(anon(), productEgOnly, "EG");
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.detail.product.currency).toBe("EGP");
  });

  it("detail: a SA-only product under EG resolves to the DC-2 soft state (not_in_market), no price", async () => {
    const result = await queryProductDetail(anon(), productSaOnly, "EG");
    expect(result.status).toBe("not_in_market");
    expect(result).not.toHaveProperty("detail");
  });

  it("detail: a nonexistent product resolves to not_found (real 404)", async () => {
    const result = await queryProductDetail(anon(), randomUUID(), "EG");
    expect(result.status).toBe("not_found");
  });
});
