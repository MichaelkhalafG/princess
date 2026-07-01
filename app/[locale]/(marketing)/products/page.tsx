import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { FilterBar } from "@/components/shared/FilterBar";
import { ProductGridSkeleton } from "@/components/shared/ProductCardSkeleton";
import { getCategories } from "@/features/catalog/categories";
import { getAttributes, getCatalogFacets } from "@/features/catalog/queries";
import { parseFacets, productFiltersSchema, type ProductFilters } from "@/features/catalog/schema";
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

  const titleFont = params.locale === "ar" ? "font-arabic font-bold" : "font-serif";

  return (
    <div className="container py-12 lg:py-16">
      <h1 className={cn("text-h1 text-foreground", titleFont)}>{t("title")}</h1>

      <div className="mt-8 lg:grid lg:grid-cols-[260px_1fr] lg:gap-10">
        <FilterBar
          categories={categoryOptions}
          attributes={attributes}
          optionCounts={facetCounts.optionCounts}
        />

        <div className="mt-6 lg:mt-0">
          <Suspense
            key={`${market}:${JSON.stringify(filters)}:${JSON.stringify(facets)}`}
            fallback={<ProductGridSkeleton />}
          >
            <ProductResults
              filters={filters}
              market={market}
              facets={facets}
              categoryOptions={categoryOptions}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
