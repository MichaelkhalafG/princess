"use client";

import { useLocale, useTranslations } from "next-intl";
import { Fragment } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/** Fixed display order + endonym labels (shown in their own script). */
const ORDER: readonly Locale[] = ["en", "ar"];
const LABEL: Record<Locale, string> = { en: "EN", ar: "ع" };

interface LocaleSwitcherProps {
  className?: string;
}

/**
 * Segmented locale toggle ("EN | ع", DESIGN_RULES §13). Switches /ar ↔ /en
 * preserving the current path (next-intl re-resolves the same pathname under the
 * other locale). Active locale = foreground, inactive = muted.
 */
export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");

  return (
    <div role="group" aria-label={t("language")} className={cn("flex items-center gap-1", className)}>
      {ORDER.map((loc, index) => (
        <Fragment key={loc}>
          {index > 0 ? (
            <span aria-hidden className="text-mist">
              |
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            aria-pressed={loc === locale}
            onClick={() => {
              if (loc !== locale) router.replace(pathname, { locale: loc });
            }}
            className={cn(
              "h-auto min-w-0 rounded-sm px-2 py-1 text-caption font-semibold hover:bg-accent/50",
              loc === "ar" && "font-arabic text-body-sm",
              loc === locale ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {LABEL[loc]}
          </Button>
        </Fragment>
      ))}
    </div>
  );
}
