import { BadgeCheck, Store } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { PublicVendor } from "@/features/catalog/queries";
import { cn } from "@/lib/utils";

interface SellerInfoCardProps {
  vendor: PublicVendor;
  locale: string;
}

/**
 * Minimal public seller block on product detail (CR-01 §E) — display name, approved
 * market chips, and (Phase 1.6) a verification badge. Reads only `public_vendor_profiles`
 * fields (NO contact/PII). The badge reflects `is_verified`, which stays false until the
 * Phase-1.6 KYC flow sets it — so it renders only when actually verified (placeholder now).
 */
export async function SellerInfoCard({ vendor, locale }: SellerInfoCardProps) {
  const t = await getTranslations("sellerCard");
  const tMarket = await getTranslations("market");
  const name = vendor.displayName?.trim() || t("unnamed");

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-soft">
      <span className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
        {t("soldBy")}
      </span>
      <div className="flex items-center gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary text-primary"
          aria-hidden
        >
          <Store className="h-5 w-5" />
        </span>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className={cn("text-body font-semibold text-foreground", locale === "ar" && "font-arabic")}>
              {name}
            </span>
            {vendor.isVerified ? (
              <span className="inline-flex items-center gap-1 text-caption font-medium text-gold">
                <BadgeCheck className="h-4 w-4" aria-hidden />
                {t("verified")}
              </span>
            ) : null}
          </div>
          {vendor.markets.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {vendor.markets.map((market) => (
                <span
                  key={market}
                  className="rounded-full bg-muted px-2 py-0.5 text-caption text-muted-foreground"
                >
                  {tMarket(`name.${market}`)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
