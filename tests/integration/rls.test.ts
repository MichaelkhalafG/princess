import { readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/database.types";

/**
 * RLS policy smoke tests (Phase 0 DoD; CLAUDE_RULES §11) against the LIVE Supabase
 * project, via the anon key + RLS only (the browser's exact access path).
 *
 * OPT-IN: runs only when `RLS_TEST=1` AND the Supabase public env vars are present.
 * Plain `pnpm test` (CI/sandbox) skips it, so it never hits the live DB or creates
 * users unintentionally. Requires Supabase Auth "Confirm email" = OFF (so signUp
 * returns a session). Created users use `@rls-test.princess.test` — teardown SQL
 * is documented in tests/integration/auth.rls-smoke.md.
 *
 * Run (dev machine, `.env.local` has the keys): add `RLS_TEST=1` to `.env.local`,
 * then `pnpm test rls`.
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

describe.skipIf(!ENABLED)("RLS — profiles + platform config (live, anon key)", () => {
  const email = `rls-${Date.now()}@rls-test.princess.test`;
  const password = "Princess12345";
  let client: SupabaseClient<Database>;
  let userId = "";

  beforeAll(() => {
    client = newAnonClient();
  });

  afterAll(async () => {
    await client.auth.signOut();
  });

  it("anon cannot read any profiles row (deny-by-default)", async () => {
    const anon = newAnonClient();
    const { data } = await anon.from("profiles").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("anon cannot read platform_settings (authenticated-only policy)", async () => {
    const anon = newAnonClient();
    const { data } = await anon.from("platform_settings").select("singleton");
    expect(data ?? []).toHaveLength(0);
  });

  it("signUp returns a session and the trigger sets customer → active", async () => {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { role: "customer", full_name: "RLS Test" } },
    });
    expect(error).toBeNull();
    // Requires "Confirm email" OFF; otherwise session is null and auth checks can't run.
    expect(data.session).not.toBeNull();
    userId = data.user?.id ?? "";
    expect(userId).not.toBe("");
  });

  it("authenticated user reads only their own profile", async () => {
    const { data, error } = await client.from("profiles").select("id, role, status");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(userId);
    expect(data?.[0]?.role).toBe("customer");
    expect(data?.[0]?.status).toBe("active");
  });

  it("authenticated user can read platform_settings", async () => {
    const { data, error } = await client.from("platform_settings").select("commission_products");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("allows updating a granted column (full_name)", async () => {
    const { error } = await client.from("profiles").update({ full_name: "Updated Name" }).eq("id", userId);
    expect(error).toBeNull();
  });

  it("blocks privilege escalation — role update denied", async () => {
    const { error } = await client.from("profiles").update({ role: "admin" }).eq("id", userId);
    expect(error).not.toBeNull();
  });

  it("blocks privilege escalation — status update denied", async () => {
    const { error } = await client.from("profiles").update({ status: "active" }).eq("id", userId);
    expect(error).not.toBeNull();
  });

  it("role/status are unchanged after the escalation attempts", async () => {
    const { data } = await client.from("profiles").select("role, status");
    expect(data?.[0]?.role).toBe("customer");
    expect(data?.[0]?.status).toBe("active");
  });
});
