import { readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/database.types";

/**
 * Seller product RLS isolation tests (Task 1.7 DoD; CLAUDE_RULES §11) against the
 * LIVE Supabase project, via the anon key + RLS only (the browser's exact path).
 *
 * Proves the deny-by-default ownership model on `products`:
 *   - anon cannot INSERT a product (writes are authenticated-only)
 *   - a draft product is invisible to anon + other users (public read = active only)
 *   - seller B cannot UPDATE or DELETE seller A's product (owner-only ALL policy)
 *   - seller A can read / update / delete their own product
 *
 * The owner policy is role-agnostic (`seller_id = auth.uid()`), so two plain
 * customer users are enough to prove RLS isolation here. Role/pending-seller
 * enforcement is an APP-layer concern (route guards, REQ-AUTH-05) and is covered
 * by the Playwright E2E + manual browser steps, not this DB-layer test.
 *
 * OPT-IN: runs only when `RLS_TEST=1` AND the Supabase public env vars are present
 * (mirrors rls.test.ts). Requires Supabase Auth "Confirm email" = OFF so signUp
 * returns a session. Created users use `@rls-test.princess.test`; teardown SQL is
 * documented in tests/integration/auth.rls-smoke.md. Created products are deleted
 * by their owner in afterAll.
 *
 * Run (dev machine, `.env.local` has the keys): add `RLS_TEST=1` to `.env.local`,
 * then `pnpm test products-rls`.
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
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const ENABLED = process.env.RLS_TEST === "1" && SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";

const newAnonClient = () => createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
const password = "Princess12345";

async function signUpCustomer(
  client: SupabaseClient<Database>,
  email: string,
): Promise<string> {
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { role: "customer", full_name: "RLS Product Test" } },
  });
  expect(error).toBeNull();
  expect(data.session).not.toBeNull(); // requires "Confirm email" OFF
  const id = data.user?.id ?? "";
  expect(id).not.toBe("");
  return id;
}

describe.skipIf(!ENABLED)("RLS — products owner isolation (live, anon key)", () => {
  const stamp = Date.now();
  let clientA: SupabaseClient<Database>;
  let clientB: SupabaseClient<Database>;
  let sellerA = "";
  let sellerB = "";
  let productId = "";

  beforeAll(async () => {
    clientA = newAnonClient();
    clientB = newAnonClient();
    sellerA = await signUpCustomer(clientA, `rls-prod-a-${stamp}@rls-test.princess.test`);
    sellerB = await signUpCustomer(clientB, `rls-prod-b-${stamp}@rls-test.princess.test`);
  });

  afterAll(async () => {
    if (productId) await clientA.from("products").delete().eq("id", productId);
    await clientA.auth.signOut();
    await clientB.auth.signOut();
  });

  it("anon cannot insert a product", async () => {
    const anon = newAnonClient();
    const { error } = await anon
      .from("products")
      .insert({ seller_id: sellerA, title: "Anon Forbidden", price: 100, currency: "SAR" });
    expect(error).not.toBeNull();
  });

  it("seller A creates their own draft product", async () => {
    const { data, error } = await clientA
      .from("products")
      .insert({
        seller_id: sellerA,
        title: "Seller A Draft",
        price: 250,
        currency: "SAR",
        status: "draft",
      })
      .select("id, seller_id, status")
      .single();
    expect(error).toBeNull();
    expect(data?.seller_id).toBe(sellerA);
    expect(data?.status).toBe("draft");
    productId = data?.id ?? "";
    expect(productId).not.toBe("");
  });

  it("seller A cannot insert a product spoofing seller B's id", async () => {
    const { error } = await clientA
      .from("products")
      .insert({ seller_id: sellerB, title: "Spoofed", price: 10, currency: "SAR" });
    expect(error).not.toBeNull();
  });

  it("a draft product is invisible to anon (public read = active only)", async () => {
    const anon = newAnonClient();
    const { data } = await anon.from("products").select("id").eq("id", productId);
    expect(data ?? []).toHaveLength(0);
  });

  it("seller B cannot see seller A's draft product", async () => {
    const { data } = await clientB.from("products").select("id").eq("id", productId);
    expect(data ?? []).toHaveLength(0);
  });

  it("seller B's update of seller A's product affects no rows", async () => {
    const { data } = await clientB
      .from("products")
      .update({ title: "Hijacked" })
      .eq("id", productId)
      .select("id");
    expect(data ?? []).toHaveLength(0); // RLS scopes the row out — nothing updated
  });

  it("seller B's delete of seller A's product affects no rows", async () => {
    const { data } = await clientB
      .from("products")
      .delete()
      .eq("id", productId)
      .select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("seller A still owns an unchanged product after B's attempts", async () => {
    const { data, error } = await clientA
      .from("products")
      .select("id, title, seller_id")
      .eq("id", productId)
      .single();
    expect(error).toBeNull();
    expect(data?.seller_id).toBe(sellerA);
    expect(data?.title).toBe("Seller A Draft"); // untouched by B
  });

  it("seller A can update their own product", async () => {
    const { data, error } = await clientA
      .from("products")
      .update({ title: "Seller A Updated" })
      .eq("id", productId)
      .select("title")
      .single();
    expect(error).toBeNull();
    expect(data?.title).toBe("Seller A Updated");
  });

  it("seller A can delete their own product", async () => {
    const { data, error } = await clientA
      .from("products")
      .delete()
      .eq("id", productId)
      .select("id");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
    productId = ""; // already gone — skip afterAll delete
  });
});
