import "server-only";

import type { Market } from "@/lib/markets";
import { createClient } from "@/lib/supabase/server";

/** A market the vendor has declared, with its approval state (CR-01 §B). */
export interface VendorMarket {
  market: Market;
  isApproved: boolean;
  branchName: string | null;
}

/**
 * The signed-in vendor's declared markets (RLS scopes to their own rows). Approval is
 * admin-only (Phase 1.6); in dev the seed pre-approves the seed sellers' markets.
 */
export async function getMyMarkets(): Promise<VendorMarket[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("vendor_markets")
    .select("market, is_approved, branch_name")
    .eq("vendor_id", user.id)
    .order("market");
  return (data ?? []).map((row) => ({
    market: row.market,
    isApproved: row.is_approved,
    branchName: row.branch_name,
  }));
}
