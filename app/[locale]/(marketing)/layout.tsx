import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";

import { Footer } from "@/components/shared/Footer";
import { MarketChooser } from "@/components/shared/MarketChooser";
import { Navbar } from "@/components/shared/Navbar";
import { getActiveMarket, getGeoHint } from "@/lib/markets-server";

/**
 * Public marketing shell (COMPONENT_TREE §2) — Navbar + Footer wrap the landing
 * and other public pages. Auth pages and dashboards keep their own shells, so
 * the nav/footer are scoped here, not in the root `[locale]/layout`.
 *
 * Resolves the active market once here (CR-01 §A): the Navbar's MarketSwitcher shows
 * it, and when it is unresolved the first-visit MarketChooser is rendered (geo-hinted).
 */
export default async function MarketingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(params.locale);

  const activeMarket = await getActiveMarket();
  const geoHint = getGeoHint();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar market={activeMarket ?? geoHint} />
      <div className="flex-1">{children}</div>
      <Footer />
      {activeMarket === null ? <MarketChooser geoHint={geoHint} /> : null}
    </div>
  );
}
