"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useFilters } from "@/lib/hooks/use-filters";

/** Reset-all-filters CTA for the empty state (Direction A `.pempty__cta`). URL-driven. */
export function ClearFiltersButton() {
  const t = useTranslations("products");
  const { clear } = useFilters();
  return (
    <Button type="button" onClick={clear} className="shadow-soft">
      {t("emptyState.reset")}
    </Button>
  );
}
