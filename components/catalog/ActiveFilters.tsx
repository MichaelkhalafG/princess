"use client";

import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import type { CategoryOption } from "@/components/shared/FilterBar";
import type { AttributeView } from "@/features/catalog/queries";
import { useFilters } from "@/lib/hooks/use-filters";
import { cn } from "@/lib/utils";

interface ActiveFiltersProps {
  categories: CategoryOption[];
  attributes: AttributeView[];
  className?: string;
}

interface Chip {
  key: string;
  label: string;
  onRemove: () => void;
}

/**
 * Removable active-filter chips (Direction A `.pchips`) above the grid — one per active
 * filter (category, max-price, rentable, each color/size), plus a "clear all" chip.
 * URL-driven via `useFilters`; renders nothing when no filter is active. Peach-soft pills.
 */
export function ActiveFilters({ categories, attributes, className }: ActiveFiltersProps) {
  const t = useTranslations("filters");
  const locale = useLocale();
  const { category, maxPrice, rentable, facets, isActive, setCategory, setMaxPrice, setRentable, toggleFacet, clear } =
    useFilters();

  if (!isActive) return null;

  const chips: Chip[] = [];

  if (category !== null) {
    const match = categories.find((option) => option.value === category);
    chips.push({ key: "category", label: match?.label ?? category, onRemove: () => setCategory(null) });
  }
  if (maxPrice !== null) {
    chips.push({ key: "price", label: `${t("upTo")} ${maxPrice}`, onRemove: () => setMaxPrice(null) });
  }
  if (rentable) {
    chips.push({ key: "rentable", label: t("rentableOnly"), onRemove: () => setRentable(false) });
  }
  for (const [attributeSlug, optionSlugs] of Object.entries(facets)) {
    const attribute = attributes.find((entry) => entry.slug === attributeSlug);
    for (const optionSlug of optionSlugs) {
      const option = attribute?.options.find((entry) => entry.slug === optionSlug);
      const label = option ? (locale === "ar" ? option.valueAr : option.valueEn) : optionSlug;
      chips.push({
        key: `${attributeSlug}:${optionSlug}`,
        label,
        onRemove: () => toggleFacet(attributeSlug, optionSlug),
      });
    }
  }

  return (
    <div data-testid="active-filters" className={cn("flex flex-wrap gap-2", className)}>
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1.5 rounded-full border border-secondary bg-muted px-3 py-1 text-caption font-semibold text-primary"
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={`${t("remove")}: ${chip.label}`}
            className="opacity-70 transition-opacity hover:opacity-100"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={clear}
        data-testid="filter-chip-clear"
        className="inline-flex items-center rounded-full border border-dashed border-border px-3 py-1 text-caption font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
      >
        {t("clear")}
      </button>
    </div>
  );
}
