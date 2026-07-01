import "server-only";

import { cookies } from "next/headers";

import {
  DEFAULT_MARKET,
  MARKET_COOKIE,
  MARKET_GEO_COOKIE,
  isMarket,
  type Market,
} from "@/lib/markets";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side market resolution (CR-01 §A, Q-A; REQ-MKT-02). Import guarded with
 * `server-only` so it never reaches the client bundle (it reads cookies + the DB).
 *
 * Resolution order (never silently trusts geo):
 *   1. the `market` cookie (set only by an explicit user choice via `/api/market`)
 *   2. `profiles.market` for a signed-in visitor (their saved choice)
 *   3. `null` → unresolved → the caller shows the first-visit MarketChooser
 *
 * A client-supplied `?market=` is intentionally NOT honored here — only trusted
 * admin/testing callers may pass an override (applied at the product-query layer in
 * Task 1.5.3), never anonymous browser input.
 */
export async function getActiveMarket(): Promise<Market | null> {
  const fromCookie = cookies().get(MARKET_COOKIE)?.value;
  if (isMarket(fromCookie)) return fromCookie;

  // No cookie yet — a signed-in visitor may still have a saved preference (e.g. a
  // new device). Anonymous visitors fall through to the chooser.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("market").eq("id", user.id).single();
  const saved = data?.market;
  return isMarket(saved) ? saved : null;
}

/**
 * The market to use for a catalog READ. Resolves the active market and falls back to
 * DEFAULT_MARKET ('EG') when unchosen — so pages always have a market to query while
 * the chooser is shown on top. A `?market=` override is honored ONLY for an admin
 * (testing/support); anonymous browser input is never trusted (CR-01 §A.3, Task 1.5.2).
 */
export async function resolveReadMarket(override?: string | null): Promise<Market> {
  if (override && isMarket(override)) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (data?.role === "admin") return override;
    }
  }
  return (await getActiveMarket()) ?? DEFAULT_MARKET;
}

/**
 * The geo HINT for pre-highlighting the chooser (DC-1). Reads the cookie the
 * middleware derived from `request.geo.country`; falls back to DEFAULT_MARKET ('EG')
 * when geo is unavailable/ambiguous. This is only a suggestion — it never becomes the
 * active market until the visitor confirms.
 */
export function getGeoHint(): Market {
  const hint = cookies().get(MARKET_GEO_COOKIE)?.value;
  return isMarket(hint) ? hint : DEFAULT_MARKET;
}
