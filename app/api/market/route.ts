import { apiError, apiSuccess, ERROR_CODES } from "@/lib/api";
import { getActiveMarket } from "@/lib/markets-server";
import { isMarket, MARKET_COOKIE } from "@/lib/markets";
import { createClient } from "@/lib/supabase/server";

/**
 * Market selector API (CR-01 §A.3, REQ-MKT-02). Reads/sets the visitor's explicit
 * market. The market is server-resolved everywhere else (cookie → profile) — this
 * route is the ONLY place a client value is accepted, and only to record the
 * visitor's own deliberate choice (validated server-side).
 *
 * GET  → { market } (the resolved active market, or null if unchosen).
 * POST → { market } body; sets the cookie and, when signed in, persists
 *        `profiles.market` (via the user's own session — the 0008 column grant
 *        allows self-writing market/country). Never touches locale.
 */
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function GET() {
  return apiSuccess({ market: await getActiveMarket() });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(ERROR_CODES.VALIDATION, "Expected a JSON body with a { market } field.", 400);
  }

  const market = (body as { market?: unknown }).market;
  if (!isMarket(market)) {
    return apiError(ERROR_CODES.VALIDATION, "market must be one of: EG, SA.", 400);
  }

  // Persist to the profile for signed-in visitors (best-effort — the cookie is the
  // primary store, so a profile write failure must not block the selection).
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("profiles").update({ market }).eq("id", user.id);
  }

  const response = apiSuccess({ market });
  response.cookies.set(MARKET_COOKIE, market, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR_SECONDS,
  });
  return response;
}
