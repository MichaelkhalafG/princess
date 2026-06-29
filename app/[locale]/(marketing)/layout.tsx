import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";

import { Footer } from "@/components/shared/Footer";
import { Navbar } from "@/components/shared/Navbar";

/**
 * Public marketing shell (COMPONENT_TREE §2) — Navbar + Footer wrap the landing
 * and other public pages. Auth pages and dashboards keep their own shells, so
 * the nav/footer are scoped here, not in the root `[locale]/layout`.
 */
export default function MarketingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(params.locale);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
