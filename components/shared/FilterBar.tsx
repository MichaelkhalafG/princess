"use client";

import { SlidersHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SORT_OPTIONS, useFilters } from "@/lib/hooks/use-filters";
import { cn } from "@/lib/utils";

/** Category option for the select (parent passes these — e.g. from `getCategories`, Task 1.5). */
export interface CategoryOption {
  value: string; // slug or id
  label: string;
}

interface FilterBarProps {
  categories: CategoryOption[];
  className?: string;
}

const TRIGGER_CLASS = "h-11 bg-card";

/** The actual controls — rendered inline on desktop and inside the mobile Sheet. */
function FilterControls({ categories }: { categories: CategoryOption[] }) {
  const t = useTranslations("filters");
  const { category, minPrice, maxPrice, sort, isActive, setCategory, setSort, setPrice, clear } =
    useFilters();
  const id = useId();

  const [min, setMin] = useState(minPrice?.toString() ?? "");
  const [max, setMax] = useState(maxPrice?.toString() ?? "");

  // Re-sync local inputs when the URL changes externally (e.g. "clear all", back button).
  useEffect(() => setMin(minPrice?.toString() ?? ""), [minPrice]);
  useEffect(() => setMax(maxPrice?.toString() ?? ""), [maxPrice]);

  const toValue = (raw: string): number | null => {
    if (raw.trim() === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex flex-col gap-1 sm:w-48">
        <span className="text-caption font-medium text-muted-foreground">{t("category")}</span>
        <Select
          value={category ?? "all"}
          onValueChange={(value) => setCategory(value === "all" ? null : value)}
        >
          <SelectTrigger
            aria-label={t("category")}
            className={TRIGGER_CLASS}
            data-testid="filter-category"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allCategories")}</SelectItem>
            {categories.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-min`} className="text-caption font-medium text-muted-foreground">
          {t("minPrice")}
        </label>
        <Input
          id={`${id}-min`}
          type="number"
          inputMode="numeric"
          min={0}
          data-testid="filter-min-price"
          value={min}
          onChange={(event) => {
            setMin(event.target.value);
            setPrice({ minPrice: toValue(event.target.value) });
          }}
          className={cn(TRIGGER_CLASS, "w-full sm:w-28")}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-max`} className="text-caption font-medium text-muted-foreground">
          {t("maxPrice")}
        </label>
        <Input
          id={`${id}-max`}
          type="number"
          inputMode="numeric"
          min={0}
          data-testid="filter-max-price"
          value={max}
          onChange={(event) => {
            setMax(event.target.value);
            setPrice({ maxPrice: toValue(event.target.value) });
          }}
          className={cn(TRIGGER_CLASS, "w-full sm:w-28")}
        />
      </div>

      <div className="flex flex-col gap-1 sm:w-48">
        <span className="text-caption font-medium text-muted-foreground">{t("sortLabel")}</span>
        <Select value={sort} onValueChange={(value) => setSort(value as (typeof SORT_OPTIONS)[number])}>
          <SelectTrigger
            aria-label={t("sortLabel")}
            className={TRIGGER_CLASS}
            data-testid="filter-sort"
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
      </div>

      {isActive ? (
        <Button
          type="button"
          variant="ghost"
          onClick={clear}
          className="h-11 text-muted-foreground hover:text-foreground"
        >
          {t("clear")}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Catalog filter bar (COMPONENT_TREE; DESIGN_RULES §5). Inline on lg+, collapses
 * into a Sheet on smaller screens. All state lives in the URL via `useFilters`.
 */
export function FilterBar({ categories, className }: FilterBarProps) {
  const t = useTranslations("filters");
  const locale = useLocale();

  return (
    <div className={className}>
      {/* Controls render twice (inline desktop + mobile Sheet) so the inner
          testids are duplicated in the DOM — E2E scopes queries to `filter-bar`
          (the lg+ inline copy Playwright's desktop viewport shows) to disambiguate. */}
      <div className="hidden lg:block" data-testid="filter-bar">
        <FilterControls categories={categories} />
      </div>

      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" className="h-11 gap-2">
              <SlidersHorizontal className="h-5 w-5" aria-hidden />
              {t("title")}
            </Button>
          </SheetTrigger>
          <SheetContent side={locale === "ar" ? "right" : "left"} className="w-80 overflow-y-auto">
            <SheetHeader className="text-start">
              <SheetTitle>{t("title")}</SheetTitle>
            </SheetHeader>
            <div className="mt-6 flex flex-col gap-6">
              <FilterControls categories={categories} />
              <SheetClose asChild>
                <Button type="button" className="h-11 w-full">
                  {t("done")}
                </Button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
