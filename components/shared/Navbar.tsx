import { NavbarClient } from "@/components/shared/NavbarClient";
import { getSessionProfile } from "@/features/auth/queries";

/**
 * Navbar (COMPONENT_TREE §8). Server component: resolves the session profile
 * once (role + name) and hands it to the client chrome — no client auth flash,
 * RLS-scoped. Role drives the auth menu (login/register vs dashboard/logout).
 */
export async function Navbar() {
  const profile = await getSessionProfile();
  return <NavbarClient role={profile?.role ?? null} userName={profile?.full_name ?? null} />;
}
