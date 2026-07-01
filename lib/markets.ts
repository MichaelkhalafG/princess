import type { Enums } from "@/lib/database.types";

/**
 * Markets — the single source of truth for the regional-market axis (CR-01 §A,
 * REQ-MKT-01/02). A market governs *visibility, currency, shipping, COD* and is
 * **independent of locale** (`ar`/`en`) — the four combos `{ar,en}×{EG,SA}` are all
 * valid. There is deliberately **no FX / conversion** here: markets are isolated,
 * prices are entered per market (`product_prices`).
 *
 * Pure module (no `next/headers`, no React, no DB client) so it is safe to import
 * from Server Components, client components, route handlers, AND the dev seed
 * (`scripts/seed-dummy.ts`). Server-only resolution lives in `lib/markets-server.ts`.
 */
export type Market = Enums<"market">;
type Currency = Enums<"currency_code">;

/** Fixed display/iteration order. `satisfies` keeps the literal tuple in sync with the DB enum. */
export const MARKETS = ["EG", "SA"] as const satisfies readonly Market[];

/** Market → currency (EG→EGP, SA→SAR). The ONLY place this mapping is defined. */
export const CURRENCY_BY_MARKET: Record<Market, Currency> = {
  EG: "EGP",
  SA: "SAR",
};

/**
 * Fallback market when nothing is resolved and geo is unavailable/ambiguous (DC-1).
 * Egypt is the primary launch market.
 */
export const DEFAULT_MARKET: Market = "EG";

/** Cookie the app sets ONLY on an explicit user choice (the resolved active market). */
export const MARKET_COOKIE = "market";
/** Cookie the middleware sets from the geo guess — a HINT for the chooser, never the active market. */
export const MARKET_GEO_COOKIE = "market_geo";

/** Runtime guard: is `value` one of our markets? */
export function isMarket(value: unknown): value is Market {
  return typeof value === "string" && (MARKETS as readonly string[]).includes(value);
}

/** The currency for a market (derived, never stored twice). */
export function marketToCurrency(market: Market): Currency {
  return CURRENCY_BY_MARKET[market];
}
