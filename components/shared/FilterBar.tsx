"use client";

import { ChevronDown, SlidersHorizontal, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { AttributeView } from "@/features/catalog/queries";
import { useFilters } from "@/lib/hooks/use-filters";
import { type Currency, formatMoney, toMinor } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Category option for the list (parent passes these — e.g. from `getCategories`, Task 1.5). */
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
  /** Per-category product counts for the active market (category id → count). */
  categoryCounts: Record<string, number>;
  /** Highest available price in the active market — the max-price slider's ceiling. */
  priceCeiling: number;
  /** Active market's currency — for the slider's live value. */
  currency: Currency;
  className?: string;
}

// `.pfilt__t` — 600 11px .12em UPPERCASE mauve-gray; ar: 13px .02em, NOT uppercase.
const SECTION_TITLE =
  "text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground rtl:text-[13px] rtl:normal-case rtl:tracking-[0.02em]";
// `.pfilt` — even 18px block padding; dividers come from the parent's `divide-y` (last has none).
const section = "py-[18px]";

/**
 * Collapsible filter section (enhancement over the reference — matches its calm look).
 * A clickable header (title on the start + rotating chevron on the end) toggles a body
 * that animates via the grid-rows 0fr↔1fr trick (no height measuring; respects
 * prefers-reduced-motion). Accessible: `aria-expanded` + `aria-controls`, native button
 * keyboard support, and `inert` on the body when closed so hidden controls aren't
 * focusable. Sections start expanded; each toggles independently (local state).
 */
function FilterSection({
  name,
  title,
  children,
  defaultOpen = true,
}: {
  name: string;
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);

  // Keep collapsed content out of the tab order / a11y tree (can't be done via the
  // grid-rows trick alone, which only clips visually).
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.inert = !open;
  }, [open]);

  return (
    <div className={section}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        data-testid={`filter-section-toggle-${name}`}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 text-start"
      >
        <span className={SECTION_TITLE}>{title}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            "h-4 w-4 shrink-0 text-mist transition-transform duration-200 ease-out motion-reduce:transition-none",
            !open && "-rotate-90 rtl:rotate-90",
          )}
        />
      </button>
      <div
        id={bodyId}
        ref={bodyRef}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="pt-3.5">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Max-price slider body (Direction A `.pprice`) — single ceiling, market-aware, live value. */
function PriceSlider({ ceiling, currency }: { ceiling: number; currency: Currency }) {
  const t = useTranslations("filters");
  const locale = useLocale();
  const { maxPrice, setMaxPrice } = useFilters();
  const max = Math.max(ceiling, 1);
  const [value, setValue] = useState(maxPrice ?? max);

  // Re-sync when the URL changes externally (clear-all, chip removal, back button).
  useEffect(() => setValue(maxPrice ?? max), [maxPrice, max]);

  const fill = `${Math.round((Math.min(value, max) / max) * 100)}%`;

  return (
    <div>
      {/* Read-out row: "up to" + live value in serif + currency. */}
      <div className="flex items-baseline justify-between">
        <span className="text-caption text-muted-foreground">{t("upTo")}</span>
        <span className="font-serif text-body-lg tabular-nums text-foreground">
          {formatMoney(toMinor(value, currency), currency, locale)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        data-testid="filter-max-price"
        aria-label={t("priceRange")}
        onChange={(event) => {
          const next = Number(event.target.value);
          setValue(next);
          // At the ceiling → no filter (show everything); otherwise cap the price.
          setMaxPrice(next >= max ? null : next);
        }}
        style={{ "--fill": fill } as CSSProperties}
        className="price-range mt-3"
      />
      <div className="mt-1.5 flex justify-between text-caption tabular-nums text-mist">
        <span>0</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

/** Facet body (color/size) — calm toggle chips with quiet counts. Title lives in the header. */
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

  return (
    <div className="flex flex-wrap gap-2" data-testid={`filter-facet-${attribute.slug}`}>
      {attribute.options.map((option) => {
        const active = selected.includes(option.slug);
        const count = optionCounts[option.id] ?? 0;
        // Calm pill (mirrors `.pcat`): card bg + hairline; active = inset ring +
        // rose-gold-deep text. The count is a quiet mist number, gapped (not glued/bold).
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(option.slug)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-body-sm transition-colors",
              active
                ? "font-semibold text-primary-deep ring-1 ring-inset ring-border"
                : "text-muted-foreground hover:bg-primary/5 hover:text-foreground",
            )}
          >
            <span>{locale === "ar" ? option.valueAr : option.valueEn}</span>
            <span className="text-[12px] tabular-nums text-mist">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Deferred (Phase 5) rating filter — DISABLED "coming soon" placeholder. Body only. */
function RatingPlaceholder() {
  const t = useTranslations("filters");
  return (
    <div className="opacity-60" data-testid="filter-rating-placeholder">
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

/** One category row (Direction A `.pcat button`) — label + per-market count, active state. */
function CategoryRow({
  label,
  count,
  active,
  onSelect,
  testId,
}: {
  label: string;
  count?: number;
  active: boolean;
  onSelect: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-start text-body-sm transition-colors",
        active
          ? "bg-card font-bold text-primary-deep ring-1 ring-inset ring-border"
          : "text-muted-foreground hover:bg-primary/5 hover:text-foreground",
      )}
    >
      <span>{label}</span>
      {count !== undefined ? (
        <span className={cn("text-[12px] tabular-nums", active ? "text-primary" : "text-mist")}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

/** Rentable on/off toggle switch body (Direction A `.ptoggle` + `.pswitch`). */
function RentableToggle() {
  const t = useTranslations("filters");
  const { rentable, setRentable } = useFilters();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={rentable}
      data-testid="filter-rentable"
      onClick={() => setRentable(!rentable)}
      className="flex w-full items-center justify-between gap-3 text-start"
    >
      <span className="flex flex-col">
        <span className="text-body-sm font-semibold text-foreground">{t("rentableOnly")}</span>
        <span className="text-caption text-mist">{t("rentableHint")}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          rentable ? "bg-primary" : "bg-accent",
        )}
      >
        <span
          className={cn(
            "absolute start-0.5 top-0.5 h-5 w-5 rounded-full bg-card shadow-soft transition-transform",
            rentable && "translate-x-5 rtl:-translate-x-5",
          )}
        />
      </span>
    </button>
  );
}

/** The actual controls — rendered inline in the desktop sidebar and inside the mobile Sheet. */
function FilterControls({
  categories,
  attributes,
  optionCounts,
  categoryCounts,
  priceCeiling,
  currency,
}: {
  categories: CategoryOption[];
  attributes: AttributeView[];
  optionCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  priceCeiling: number;
  currency: Currency;
}) {
  const t = useTranslations("filters");
  const locale = useLocale();
  const { category, isActive, setCategory, facets, toggleFacet, clear } = useFilters();

  return (
    <div className="flex flex-col divide-y divide-border">
      {/* Header — sliders icon + title + clear-all (Direction A `.pside__head`). Not collapsible. */}
      <div className="flex items-center justify-between pb-3.5 pt-[18px]">
        <span className="flex items-center gap-2 text-body-sm font-semibold text-foreground">
          <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden />
          {t("title")}
        </span>
        {isActive ? (
          <button
            type="button"
            onClick={clear}
            className="text-caption font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
          >
            {t("clear")}
          </button>
        ) : null}
      </div>

      {/* Order: Category → Price → Rating → Rentable → Color → Size. */}
      <FilterSection name="category" title={t("category")}>
        <ul data-testid="filter-category" aria-label={t("category")} className="flex flex-col gap-0.5">
          <li>
            <CategoryRow label={t("allCategories")} active={category === null} onSelect={() => setCategory(null)} />
          </li>
          {categories.map((option) => (
            <li key={option.value}>
              <CategoryRow
                testId={`filter-category-${option.value}`}
                label={option.label}
                count={categoryCounts[option.value] ?? 0}
                active={category === option.value}
                onSelect={() => setCategory(option.value)}
              />
            </li>
          ))}
        </ul>
      </FilterSection>

      <FilterSection name="price" title={t("priceRange")}>
        <PriceSlider ceiling={priceCeiling} currency={currency} />
      </FilterSection>

      <FilterSection name="rating" title={t("rating")}>
        <RatingPlaceholder />
      </FilterSection>

      <FilterSection name="rentable" title={t("rentableLabel")}>
        <RentableToggle />
      </FilterSection>

      {attributes.map((attribute) => (
        <FilterSection
          key={attribute.id}
          name={attribute.slug}
          title={locale === "ar" ? attribute.keyAr : attribute.keyEn}
        >
          <FacetSection
            attribute={attribute}
            selected={facets[attribute.slug] ?? []}
            optionCounts={optionCounts}
            onToggle={(optionSlug) => toggleFacet(attribute.slug, optionSlug)}
          />
        </FilterSection>
      ))}
    </div>
  );
}

/**
 * Catalog filter sidebar (COMPONENT_TREE; DESIGN_RULES §5, Direction A "Boutique
 * Sidebar"). A sticky peach-soft-tinted card column on lg+; collapses into a Sheet on
 * smaller screens. All state lives in the URL via `useFilters` (D1). Each section is
 * independently collapsible (local state). Section order: Category → Price → Rating →
 * Rentable → Color → Size. Sort lives in the main-column toolbar (`CatalogSort`).
 */
export function FilterBar({
  categories,
  attributes,
  optionCounts,
  categoryCounts,
  priceCeiling,
  currency,
  className,
}: FilterBarProps) {
  const t = useTranslations("filters");
  const locale = useLocale();
  const controls = (
    <FilterControls
      categories={categories}
      attributes={attributes}
      optionCounts={optionCounts}
      categoryCounts={categoryCounts}
      priceCeiling={priceCeiling}
      currency={currency}
    />
  );

  return (
    <div className={className}>
      {/* Controls render twice (inline desktop sidebar + mobile Sheet) so the inner
          testids are duplicated in the DOM — E2E scopes queries to `filter-bar`
          (the lg+ inline copy Playwright's desktop viewport shows) to disambiguate. */}
      {/* Sticky column (lg+ only; the mobile Sheet is separate). top = 80px collapsed
          navbar + 8px gap = 88px → no jump. Natural height, no internal scroll. Look:
          padding 6/22/22, radius-lg, peach-soft gradient tint, hairline border, shadow-soft. */}
      <aside
        className="hidden self-start rounded-lg border border-border bg-gradient-to-b from-muted to-background px-[22px] pb-[22px] pt-1.5 shadow-soft lg:sticky lg:top-[88px] lg:block"
        data-testid="filter-bar"
      >
        {controls}
      </aside>

      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" className="h-11 gap-2">
              <SlidersHorizontal className="h-5 w-5" aria-hidden />
              {t("title")}
            </Button>
          </SheetTrigger>
          <SheetContent
            side={locale === "ar" ? "right" : "left"}
            className="w-80 overflow-y-auto bg-gradient-to-b from-muted to-background"
          >
            <SheetTitle className="sr-only">{t("title")}</SheetTitle>
            <div className="mt-2 flex flex-col gap-6">
              {controls}
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
