"use client";

import { LayoutDashboard, LogOut, Menu, Search } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LocaleSwitcher } from "@/components/shared/LocaleSwitcher";
import { NAV_LINKS } from "@/components/shared/nav-config";
import { useLogout } from "@/lib/hooks/use-logout";
import type { UserRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { Link, usePathname } from "@/i18n/navigation";

interface MobileNavProps {
  role: UserRole | null;
  userName: string | null;
}

/** Slide-in drawer navigation for < lg (DESIGN_RULES §5/§12). Opens from the start edge. */
export function MobileNav({ role, userName }: MobileNavProps) {
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth.logout");
  const locale = useLocale();
  const pathname = usePathname();
  const { logout } = useLogout();

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 text-muted-foreground hover:text-foreground lg:hidden"
          aria-label={t("menu")}
        >
          <Menu className="h-5 w-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side={locale === "ar" ? "right" : "left"} className="w-80 gap-0 p-0">
        <SheetHeader className="border-b border-border p-6 text-start">
          <Image src="/logo.svg" alt={t("home")} width={102} height={32} unoptimized />
          <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
        </SheetHeader>

        <div className="p-4">
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist"
            />
            <Input
              type="search"
              aria-label={t("search")}
              placeholder={t("searchPlaceholder")}
              className="h-11 w-full rounded-full border-border bg-muted ps-10 text-body-sm shadow-none focus-visible:border-primary/40 focus-visible:ring-primary/30"
            />
          </div>
        </div>

        <nav className="flex flex-col gap-1 px-4 pb-4" aria-label={t("menu")}>
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <SheetClose asChild key={link.key}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-12 items-center rounded-md border-s-2 px-4 text-body transition-colors",
                    active
                      ? "border-primary bg-accent/30 font-semibold text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                  )}
                >
                  {t(link.key)}
                </Link>
              </SheetClose>
            );
          })}
        </nav>

        <Separator />

        <div className="flex flex-col gap-2 p-4">
          {role ? (
            <>
              <SheetClose asChild>
                <Button asChild variant="outline" className="h-11 w-full justify-start gap-2">
                  <Link href={`/dashboard/${role}`}>
                    <LayoutDashboard className="h-5 w-5" aria-hidden />
                    {userName ? userName : t("dashboard")}
                  </Link>
                </Button>
              </SheetClose>
              <Button
                variant="ghost"
                onClick={() => void logout()}
                className="h-11 w-full justify-start gap-2 text-destructive hover:text-destructive"
              >
                <LogOut className="h-5 w-5" aria-hidden />
                {tAuth("action")}
              </Button>
            </>
          ) : (
            <>
              <SheetClose asChild>
                <Button asChild variant="outline" className="h-11 w-full">
                  <Link href="/login">{t("login")}</Link>
                </Button>
              </SheetClose>
              <SheetClose asChild>
                <Button asChild className="h-11 w-full shadow-soft">
                  <Link href="/register">{t("register")}</Link>
                </Button>
              </SheetClose>
            </>
          )}
        </div>

        <Separator />
        <div className="p-4">
          <LocaleSwitcher className="w-full justify-start" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
