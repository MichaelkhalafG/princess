"use client";

import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SORT_OPTIONS, useFilters } from "@/lib/hooks/use-filters";

/**
 * Catalog sort control (Direction A `.pselect`) — a rounded pill select in the main
 * column toolbar (moved out of the sidebar per the reference layout). URL-driven via
 * `useFilters`; keeps `data-testid="filter-sort"`. The shadcn trigger supplies the chevron.
 */
export function CatalogSort() {
  const t = useTranslations("filters");
  const { sort, setSort } = useFilters();

  return (
    <Select value={sort} onValueChange={(value) => setSort(value as (typeof SORT_OPTIONS)[number])}>
      <SelectTrigger
        aria-label={t("sortLabel")}
        data-testid="filter-sort"
        className="h-11 w-auto gap-2 rounded-full border-border bg-card px-4 text-body-sm"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option} value={option}>
            {t(`sort.${option}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
