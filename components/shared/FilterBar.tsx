"use client";

import { SlidersHorizontal, Star } from "lucide-react";
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
import type { AttributeView } from "@/features/catalog/queries";
import { SORT_OPTIONS, useFilters } from "@/lib/hooks/use-filters";
import { cn } from "@/lib/utils";

/** Category option for the select (parent passes these — e.g. from `getCategories`, Task 1.5). */
export interface CategoryOption {
  value: string; // slug or id
  label: string;
}

interface FilterBarProps {
  categories: CategoryOption[];
  /** Controlled facet vocabulary (color/size) — CR-01 §G. */
  attributes: AttributeView[];
  /** Per-option product counts for the active market (option id → count). */
  optionCounts: Record<string, number>;
  className?: string;
}

const CONTROL_CLASS = "h-11 bg-card";

/** A labelled facet group (e.g. Color, Size) as toggle chips with per-option counts. */
function FacetSection({
  attribute,
  selected,
  optionCounts,
  onToggle,
}: {
  attribute: AttributeView;
  selected: string[];
  optionCounts: Record<string, number>;
  onToggle: (optionSlug: string) => void;
}) {
  const locale = useLocale();
  const label = locale === "ar" ? attribute.keyAr : attribute.keyEn;

  return (
    <div className="flex flex-col gap-2" data-testid={`filter-facet-${attribute.slug}`}>
      <span className="text-caption font-semibold text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-2">
        {attribute.options.map((option) => {
          const active = selected.includes(option.slug);
          const count = optionCounts[option.id] ?? 0;
          return (
            <Button
              key={option.id}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              aria-pressed={active}
              onClick={() => onToggle(option.slug)}
              className="gap-1.5"
            >
              {locale === "ar" ? option.valueAr : option.valueEn}
              <span className={cn("text-caption", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                {count}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Deferred (Phase 5) rating filter — rendered as a DISABLED placeholder so the sidebar
 * matches Direction A without implying the feature exists yet (reviews land in Phase 5).
 */
function RatingPlaceholder() {
  const t = useTranslations("filters");
  return (
    <div className="flex flex-col gap-2 opacity-60" data-testid="filter-rating-placeholder">
      <span className="text-caption font-semibold text-muted-foreground">{t("rating")}</span>
      <div className="flex items-center gap-2" aria-hidden>
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }, (_, index) => (
            <Star key={index} className="h-4 w-4 text-mist" />
          ))}
        </div>
        <span className="text-caption text-mist">{t("comingSoon")}</span>
      </div>
    </div>
  );
}

/** The actual controls — rendered inline in the desktop sidebar and inside the mobile Sheet. */
function FilterControls({
  categories,
  attributes,
  optionCounts,
}: {
  categories: CategoryOption[];
  attributes: AttributeView[];
  optionCounts: Record<string, number>;
}) {
  const t = useTranslations("filters");
  const {
    category,
    minPrice,
    maxPrice,
    rentable,
    facets,
    sort,
    isActive,
    setCategory,
    setSort,
    setPrice,
    setRentable,
    toggleFacet,
    clear,
  } = useFilters();
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-caption font-medium text-muted-foreground">{t("category")}</span>
        <Select
          value={category ?? "all"}
          onValueChange={(value) => setCategory(value === "all" ? null : value)}
        >
          <SelectTrigger aria-label={t("category")} className={CONTROL_CLASS} data-testid="filter-category">
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

      <div className="grid grid-cols-2 gap-3">
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
            className={CONTROL_CLASS}
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
            className={CONTROL_CLASS}
          />
        </div>
      </div>

      {/* Rentable-only toggle (CR-01 §B). */}
      <div className="flex flex-col gap-2">
        <span className="text-caption font-semibold text-muted-foreground">{t("rentableLabel")}</span>
        <Button
          type="button"
          size="sm"
          variant={rentable ? "default" : "outline"}
          aria-pressed={rentable}
          onClick={() => setRentable(!rentable)}
          data-testid="filter-rentable"
          className="w-fit"
        >
          {t("rentableOnly")}
        </Button>
      </div>

      {/* Color + Size facet sections (with counts). */}
      {attributes.map((attribute) => (
        <FacetSection
          key={attribute.id}
          attribute={attribute}
          selected={facets[attribute.slug] ?? []}
          optionCounts={optionCounts}
          onToggle={(optionSlug) => toggleFacet(attribute.slug, optionSlug)}
        />
      ))}

      {/* Deferred rating filter — placeholder only (Phase 5). */}
      <RatingPlaceholder />

      <div className="flex flex-col gap-1">
        <span className="text-caption font-medium text-muted-foreground">{t("sortLabel")}</span>
        <Select value={sort} onValueChange={(value) => setSort(value as (typeof SORT_OPTIONS)[number])}>
          <SelectTrigger aria-label={t("sortLabel")} className={CONTROL_CLASS} data-testid="filter-sort">
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
          className="h-11 w-fit text-muted-foreground hover:text-foreground"
        >
          {t("clear")}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Catalog filter sidebar (COMPONENT_TREE; DESIGN_RULES §5, Direction A). A left column
 * on lg+; collapses into a Sheet on smaller screens. All state lives in the URL via
 * `useFilters` (D1). Color/Size facets + rentable are live; the rating filter is a
 * deferred placeholder (Phase 5).
 */
export function FilterBar({ categories, attributes, optionCounts, className }: FilterBarProps) {
  const t = useTranslations("filters");
  const locale = useLocale();

  return (
    <div className={className}>
      {/* Controls render twice (inline desktop sidebar + mobile Sheet) so the inner
          testids are duplicated in the DOM — E2E scopes queries to `filter-bar`
          (the lg+ inline copy Playwright's desktop viewport shows) to disambiguate. */}
      <aside className="hidden lg:block" data-testid="filter-bar">
        <FilterControls categories={categories} attributes={attributes} optionCounts={optionCounts} />
      </aside>

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
              <FilterControls categories={categories} attributes={attributes} optionCounts={optionCounts} />
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
