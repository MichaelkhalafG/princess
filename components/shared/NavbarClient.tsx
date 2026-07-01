"use client";

import { Search, ShoppingBag } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { AuthMenu } from "@/components/shared/AuthMenu";
import { LocaleSwitcher } from "@/components/shared/LocaleSwitcher";
import { MarketSwitcher } from "@/components/shared/MarketSwitcher";
import { MobileNav } from "@/components/shared/MobileNav";
import { NAV_LINKS } from "@/components/shared/nav-config";
import { Input } from "@/components/ui/input";
import type { Market } from "@/lib/markets";
import type { UserRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { Link, usePathname } from "@/i18n/navigation";

// Placeholder until cart state (Phase 2) — drives the rose-gold count badge.
const CART_COUNT = 2;

interface NavbarClientProps {
  role: UserRole | null;
  userName: string | null;
  market: Market;
}

/**
 * "Warm Boutique" navbar (approved design). Two stacked layers in a sticky shell:
 *  · Layer 1 — slim utility strip (peach-soft, a rationed gold hairline) that tucks
 *    away on scroll.
 *  · Layer 2 — main row (ivory): logo · centered links with a rose-gold scale-in
 *    underline · search · cart · the single rose-gold CTA. On scroll it frosts
 *    (ivory blur + faint gold border + shadow-soft) and lifts.
 * Everything mirrors for RTL via logical properties; all copy from messages/*.
 */
export function NavbarClient({ role, userName, market }: NavbarClientProps) {
  const t = useTranslations("nav");
  const tHome = useTranslations("home");
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 isolate w-full">
      {/* Layer 1 — utility strip (tucks away on scroll) */}
      <div
        className={cn(
          "flex items-center overflow-hidden border-b border-gold/50 bg-muted px-5 transition-all duration-300 ease-out motion-reduce:transition-none md:px-8 lg:px-12",
          scrolled ? "h-0 border-transparent opacity-0" : "h-10 opacity-100",
        )}
      >
        <p className="hidden text-caption text-muted-foreground lg:block">{t("returnsNote")}</p>
        <div className="ms-auto flex items-center gap-4 text-caption text-muted-foreground">
          <Link
            href="/track-order"
            className="hidden font-medium transition-colors hover:text-foreground sm:inline"
          >
            {t("trackOrder")}
          </Link>
          <span aria-hidden className="hidden text-mist sm:inline">
            ·
          </span>
          <Link
            href="/help"
            className="hidden font-medium transition-colors hover:text-foreground sm:inline"
          >
            {t("help")}
          </Link>
          <MarketSwitcher market={market} />
          <span aria-hidden className="hidden h-4 w-px bg-border sm:inline-block" />
          <LocaleSwitcher />
        </div>
      </div>

      {/* Layer 2 — main row */}
      <div
        className={cn(
          "flex h-20 items-center gap-6 px-5 transition-all duration-300 ease-out motion-reduce:transition-none md:px-8 lg:px-12",
          scrolled
            ? "border-b border-gold/25 bg-background/75 shadow-soft backdrop-blur-lg backdrop-saturate-150 supports-[backdrop-filter]:bg-background/75"
            : "border-b border-accent bg-background",
        )}
      >
        {/* Start: mobile menu + logo */}
        <div className="flex flex-1 items-center gap-3 lg:flex-none">
          <MobileNav role={role} userName={userName} />
          <Link href="/" aria-label={t("home")} className="flex items-center gap-3">
            {/* Medallion: our real Rose-Jewel mark (public/icon.svg) centered in a
                warm peach gradient circle, with breathing room (not edge-to-edge). */}
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-muted to-secondary">
              <Image src="/icon.svg" alt="" aria-hidden width={28} height={28} priority unoptimized className="h-7 w-7" />
            </span>
            <span className="font-serif text-h3 font-semibold text-foreground">{tHome("brand")}</span>
          </Link>
        </div>

        {/* Center: primary links with rose-gold scale-in underline */}
        <nav className="hidden flex-1 items-center justify-center gap-8 lg:flex" aria-label={t("menu")}>
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.key}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative py-2 text-body-sm font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(link.key)}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-0 bottom-0 h-0.5 origin-center rounded-full bg-primary transition-transform duration-200 ease-out motion-reduce:transition-none",
                    active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                  )}
                />
              </Link>
            );
          })}
        </nav>

        {/* End: search · cart · auth */}
        <div className="flex items-center gap-4">
          <div className="relative hidden lg:block">
            <Search
              aria-hidden
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist"
            />
            <Input
              type="search"
              aria-label={t("search")}
              placeholder={t("searchPlaceholder")}
              className="h-11 w-56 rounded-full border-border bg-muted ps-10 text-body-sm shadow-none focus-visible:border-primary/40 focus-visible:ring-primary/30 xl:w-64"
            />
          </div>

          <Link
            href="/cart"
            aria-label={t("cart")}
            className="relative flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent/50"
          >
            <ShoppingBag className="h-5 w-5" aria-hidden />
            {CART_COUNT > 0 ? (
              <span className="absolute end-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-caption leading-none text-primary-foreground shadow-soft">
                {CART_COUNT}
              </span>
            ) : null}
          </Link>

          <span aria-hidden className="hidden h-6 w-px bg-accent lg:inline-block" />

          <div className="hidden lg:block">
            <AuthMenu role={role} userName={userName} />
          </div>
        </div>
      </div>
    </header>
  );
}
