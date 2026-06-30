import { readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { TEST_PASSWORD } from "./fixtures";

/**
 * Seller E2E fixture (catalog spec) — mints an APPROVED seller so the seller
 * add-product flow can be driven through the real UI.
 *
 * Why a privileged fixture: registration creates sellers as `pending` (the
 * `handle_new_user` trigger), and promoting to `active` is correctly BLOCKED by
 * RLS (no privilege escalation, REQ-NFR-05). There is therefore no anon-key path
 * to an active seller, so this fixture uses the service-role key — server-side
 * only, in the trusted test process (never shipped to the browser). It mirrors
 * the env-loading + opt-in gate of tests/integration/rls.test.ts.
 *
 * OPT-IN: the seller spec runs only when `E2E_SELLER=1` AND the URL +
 * service-role key are present. Plain `pnpm test:e2e` (public catalog + auth)
 * stays green without the service-role key.
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
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Gate for the opt-in seller spec — needs the service-role key to mint an active seller. */
export const SELLER_ENABLED =
  process.env.E2E_SELLER === "1" && SUPABASE_URL !== "" && SERVICE_ROLE_KEY !== "";

export interface SeededSeller {
  id: string;
  email: string;
  password: string;
}

function admin(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Create an APPROVED seller (email pre-confirmed). The signup trigger sets the
 * profile to seller/pending; we promote it to `active` via service-role.
 * Returns the credentials so the spec can log in through the UI.
 */
export async function createActiveSeller(email: string): Promise<SeededSeller> {
  const supabase = admin();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { role: "seller", full_name: "E2E Seller" },
  });
  if (error || !data.user) {
    throw new Error(`createActiveSeller failed: ${error?.message ?? "no user returned"}`);
  }
  const id = data.user.id;
  const { error: promoteError } = await supabase
    .from("profiles")
    .update({ status: "active" })
    .eq("id", id);
  if (promoteError) throw new Error(`promote seller failed: ${promoteError.message}`);
  return { id, email, password: TEST_PASSWORD };
}

/**
 * Tear down a seeded seller: remove their uploaded storage objects, then delete
 * the auth user (cascades profiles → products → variants). Best-effort — logs
 * but never throws, so a cleanup hiccup can't fail an otherwise-green run.
 */
export async function cleanupSeller(id: string): Promise<void> {
  const supabase = admin();
  try {
    const { data: files } = await supabase.storage.from("products").list(id);
    if (files && files.length > 0) {
      await supabase.storage.from("products").remove(files.map((file) => `${id}/${file.name}`));
    }
  } catch {
    // ignore storage cleanup errors
  }
  await supabase.auth.admin.deleteUser(id);
}
