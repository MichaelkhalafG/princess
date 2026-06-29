import { Facebook, Instagram, Twitter } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { LocaleSwitcher } from "@/components/shared/LocaleSwitcher";
import { NAV_LINKS } from "@/components/shared/nav-config";
import { Link } from "@/i18n/navigation";

/**
 * Rich, warm, multi-column footer (DESIGN_RULES §1 — premium, spacious). Layered
 * on a peach-soft surface to separate it from the ivory page; generous rhythm
 * (§4.1). Brand + tagline + social, then Shop/Support/Legal columns, then a
 * bottom bar with copyright + locale.
 */
export async function Footer() {
  const t = await getTranslations("footer");
  const tn = await getTranslations("nav");
  const year = new Date().getFullYear();

  const support = [
    { href: "/about", label: t("about") },
    { href: "/contact", label: t("contact") },
    { href: "/faq", label: t("faq") },
  ];
  const legal = [
    { href: "/terms", label: t("terms") },
    { href: "/privacy", label: t("privacy") },
  ];
  const social = [
    { Icon: Instagram, label: "Instagram" },
    { Icon: Facebook, label: "Facebook" },
    { Icon: Twitter, label: "Twitter" },
  ];

  return (
    <footer className="border-t border-border bg-muted/60">
      <div className="container py-16 lg:py-24">
        <div className="grid gap-12 md:grid-cols-12">
          {/* Brand */}
          <div className="md:col-span-5 lg:col-span-6">
            <Image src="/logo.svg" alt="Princess" width={132} height={42} unoptimized className="h-9 w-auto" />
            <p className="mt-6 max-w-sm text-body-sm leading-relaxed text-muted-foreground">
              {t("tagline")}
            </p>
            <div className="mt-8">
              <p className="text-caption uppercase tracking-wide text-mist">{t("followUs")}</p>
              <div className="mt-3 flex items-center gap-2">
                {social.map(({ Icon, label }) => (
                  <a
                    key={label}
                    href="#"
                    aria-label={label}
                    className="grid h-11 w-11 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-7 lg:col-span-6">
            <FooterColumn title={t("shop")}>
              {NAV_LINKS.filter((link) => link.key !== "home").map((link) => (
                <FooterLink key={link.key} href={link.href}>
                  {tn(link.key)}
                </FooterLink>
              ))}
            </FooterColumn>
            <FooterColumn title={t("support")}>
              {support.map((item) => (
                <FooterLink key={item.href} href={item.href}>
                  {item.label}
                </FooterLink>
              ))}
            </FooterColumn>
            <FooterColumn title={t("legal")}>
              {legal.map((item) => (
                <FooterLink key={item.href} href={item.href}>
                  {item.label}
                </FooterLink>
              ))}
            </FooterColumn>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <p className="text-body-sm text-muted-foreground">{t("rights", { year })}</p>
          <LocaleSwitcher />
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-caption font-semibold uppercase tracking-wide text-foreground">{title}</h2>
      <ul className="mt-4 space-y-3">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-body-sm text-muted-foreground transition-colors hover:text-primary"
      >
        {children}
      </Link>
    </li>
  );
}
