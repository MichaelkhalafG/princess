import { NavbarClient } from "@/components/shared/NavbarClient";
import { getSessionProfile } from "@/features/auth/queries";
import type { Market } from "@/lib/markets";

interface NavbarProps {
  /** The market shown in the MarketSwitcher (server-resolved by the layout). */
  market: Market;
}

/**
 * Navbar (COMPONENT_TREE §8). Server component: resolves the session profile
 * once (role + name) and hands it to the client chrome — no client auth flash,
 * RLS-scoped. Role drives the auth menu (login/register vs dashboard/logout).
 * The active market (resolved once by the layout) drives the MarketSwitcher.
 */
export async function Navbar({ market }: NavbarProps) {
  const profile = await getSessionProfile();
  return (
    <NavbarClient
      role={profile?.role ?? null}
      userName={profile?.full_name ?? null}
      market={market}
    />
  );
}
