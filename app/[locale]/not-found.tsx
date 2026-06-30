"use client";

import { FileQuestion } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Localized 404 for the `[locale]` segment. Required so `notFound()` (e.g. an
 * unknown product id, or an invalid locale from the layout) renders INSIDE the
 * `[locale]` layout's <html> instead of Next's dev root not-found boundary — the
 * latter mounts a competing <html> and throws a hydration error on client-side
 * navigation. Client component so next-intl hooks resolve via the provider.
 */
export default function LocaleNotFound() {
  const t = useTranslations("common.notFound");
  const locale = useLocale();
  const titleFont = locale === "ar" ? "font-arabic font-bold" : "font-serif";

  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <span
        className="grid h-16 w-16 place-items-center rounded-full bg-secondary text-primary"
        aria-hidden
      >
        <FileQuestion className="h-8 w-8" />
      </span>
      <h1 className={cn("text-h2 text-foreground", titleFont)}>{t("title")}</h1>
      <p className="max-w-prose text-body text-muted-foreground">{t("description")}</p>
      <Button asChild className="mt-2 shadow-soft">
        <Link href="/">{t("cta")}</Link>
      </Button>
    </div>
  );
}
