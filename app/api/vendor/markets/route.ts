import { apiError, apiSuccess, ERROR_CODES } from "@/lib/api";
import { getMyMarkets } from "@/features/vendor/markets";
import { isMarket } from "@/lib/markets";
import { createClient } from "@/lib/supabase/server";

// API_MAP "/api/vendor/markets" (CR-01 §B, REQ-PROD-08). A vendor reads/declares the
// markets they serve. Declaring inserts a PENDING `vendor_markets` row (RLS forces
// is_approved=false → no self-approval); an admin approves it (Phase 1.6; seed pre-approves
// in dev). Typed envelope; RLS-scoped via the user's session.

/** GET — the signed-in vendor's declared markets. */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError(ERROR_CODES.UNAUTHENTICATED, "Not authenticated", 401);

  return apiSuccess({ markets: await getMyMarkets() });
}

/** POST — declare a market (pending). `{ market }` body. */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError(ERROR_CODES.UNAUTHENTICATED, "Not authenticated", 401);

  const body: unknown = await request.json().catch(() => null);
  const market = (body as { market?: unknown }).market;
  if (!isMarket(market)) {
    return apiError(ERROR_CODES.VALIDATION, "market must be one of: EG, SA.", 400);
  }

  // RLS insert policy enforces vendor_id = auth.uid() AND is_approved = false.
  const { error } = await supabase
    .from("vendor_markets")
    .insert({ vendor_id: user.id, market, is_approved: false });
  if (error) {
    // Unique (vendor_id, market) violation → already declared.
    return apiError(ERROR_CODES.CONFLICT, "Market already declared.", 409);
  }

  return apiSuccess({ markets: await getMyMarkets() }, 201);
}
