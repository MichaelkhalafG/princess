import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { FilterBar } from "@/components/shared/FilterBar";
import { ProductGridSkeleton } from "@/components/shared/ProductCardSkeleton";
import { getCategories } from "@/features/catalog/categories";
import { getAttributes, getCatalogFacets } from "@/features/catalog/queries";
import { parseFacets, productFiltersSchema, type ProductFilters } from "@/features/catalog/schema";
import { marketToCurrency } from "@/lib/markets";
import { resolveReadMarket } from "@/lib/markets-server";
import { cn } from "@/lib/utils";
import { ProductResults } from "./ProductResults";

type SearchParams = Record<string, string | string[] | undefined>;

/** Lenient parse — bad/extra params fall back to defaults so the page never crashes. */
function parseFilters(searchParams: SearchParams): ProductFilters {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") flat[key] = value;
  }
  const parsed = productFiltersSchema.safeParse(flat);
  return parsed.success ? parsed.data : productFiltersSchema.parse({});
}

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: SearchParams;
}) {
  setRequestLocale(params.locale);
  const t = await getTranslations("products");
  const tNav = await getTranslations("nav");

  const filters = parseFilters(searchParams);
  const facets = parseFacets(searchParams);
  const marketParam = typeof searchParams.market === "string" ? searchParams.market : null;
  const market = await resolveReadMarket(marketParam);

  // Vocabulary (color/size) + market-scoped baseline counts for the facet sidebar.
  const [categories, attributes, facetCounts] = await Promise.all([
    getCategories({ kind: "product" }),
    getAttributes(),
    getCatalogFacets(market),
  ]);
  const categoryOptions = categories.map((category) => ({
    value: category.id,
    label: params.locale === "ar" ? category.name_ar : category.name_en,
  }));

  // Titles: en = Marcellus (400 via font-synthesis-off) with airy tracking; ar = El Messiri
  // bold, NO tracking (never letter-space Arabic — DESIGN_RULES §3.3).
  const titleFont = params.locale === "ar" ? "font-arabic font-bold" : "font-serif tracking-[0.02em]";
  // Reference `--pad-inline: clamp(20px,4vw,56px)` — the catalog shell is wider (max-w 1600)
  // than the site container, with generous responsive inline padding (documented exception
  // to the 8px scale for pixel-parity with the approved mockup — DESIGN_RULES §4.5 changelog).
  const padInline = "px-[clamp(20px,4vw,56px)]";

  return (
    <div className="mx-auto max-w-[1600px]">
      {/* .phead — breadcrumb · serif title · subtitle · hairline divider. */}
      <header className={cn("pb-6 pt-[38px]", padInline)}>
        <nav aria-label="Breadcrumb" className="mb-3.5 flex items-center gap-2 text-caption tracking-[0.04em] text-mist">
          <span>{tNav("home")}</span>
          <span aria-hidden className="text-accent">/</span>
          <span className="text-muted-foreground">{t("title")}</span>
        </nav>
        <h1 className={cn("text-[clamp(34px,4.6vw,50px)] leading-[1.04] text-foreground", titleFont)}>
          {t("title")}
        </h1>
        <p className="mt-2.5 max-w-[48ch] text-[15px] leading-normal text-muted-foreground">{t("subtitle")}</p>
        <hr className="mt-6 border-0 border-t border-accent" />
      </header>

      {/* .plp — sidebar (272px) + main (1fr), gap 36px, top 28 / bottom 80. NOTE: the grid
          uses the default `align-items: stretch` (NOT items-start). The sticky sidebar lives
          inside FilterBar's wrapper div (the grid item); stretching that item to the row
          height gives the sticky `<aside>` a tall containing block to stick within. With
          items-start the wrapper collapsed to the aside's height and sticky had no room. */}
      <div className={cn("grid grid-cols-1 gap-9 pb-20 pt-7 lg:grid-cols-[272px_1fr]", padInline)}>
        <FilterBar
          categories={categoryOptions}
          attributes={attributes}
          optionCounts={facetCounts.optionCounts}
          categoryCounts={facetCounts.categoryCounts}
          priceCeiling={facetCounts.priceCeiling}
          currency={marketToCurrency(market)}
        />

        <main className="min-w-0">
          <Suspense
            key={`${market}:${JSON.stringify(filters)}:${JSON.stringify(facets)}`}
            fallback={<ProductGridSkeleton />}
          >
            <ProductResults
              filters={filters}
              market={market}
              facets={facets}
              categoryOptions={categoryOptions}
              attributes={attributes}
            />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
