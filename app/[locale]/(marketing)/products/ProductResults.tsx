import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ActiveFilters } from "@/components/catalog/ActiveFilters";
import { CatalogSort } from "@/components/catalog/CatalogSort";
import { ClearFiltersButton } from "@/components/catalog/ClearFiltersButton";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { EmptyState } from "@/components/shared/EmptyState";
import type { CategoryOption } from "@/components/shared/FilterBar";
import { Pagination } from "@/components/shared/Pagination";
import { listProducts, type AttributeView } from "@/features/catalog/queries";
import type { ProductFilters } from "@/features/catalog/schema";
import type { Market } from "@/lib/markets";

interface ProductResultsProps {
  filters: ProductFilters;
  market: Market;
  facets: Record<string, string[]>;
  categoryOptions: CategoryOption[];
  attributes: AttributeView[];
}

/**
 * Async results region — awaited inside <Suspense> on the list page so the skeleton shows
 * while it fetches (no CLS). Server component (no client waterfall). Reads are scoped to
 * the active market (CR-01 §A) + attribute facets via the central query. Renders the
 * Direction-A `.psort` toolbar (result count + sort pill) and the `.pchips` active-filter
 * row above the grid; the empty state offers a reset CTA.
 */
export async function ProductResults({
  filters,
  market,
  facets,
  categoryOptions,
  attributes,
}: ProductResultsProps) {
  const t = await getTranslations("products");
  const { items, total, page } = await listProducts(filters, market, facets);
  const labelById = new Map(categoryOptions.map((option) => [option.value, option.label]));

  return (
    <div className="flex flex-col">
      {/* .psort — result count (start) + sort pill (end). */}
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-sm text-muted-foreground">{t("results", { count: total })}</p>
        <CatalogSort />
      </div>

      {/* .pchips — removable active-filter chips. */}
      <ActiveFilters categories={categoryOptions} attributes={attributes} className="mb-[22px]" />

      {items.length === 0 ? (
        <EmptyState
          icon={Search}
          title={t("emptyState.title")}
          description={t("emptyState.description")}
          action={<ClearFiltersButton />}
        />
      ) : (
        <div className="flex flex-col gap-8">
          <ProductGrid>
            {items.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                categoryLabel={product.category_id ? labelById.get(product.category_id) : undefined}
              />
            ))}
          </ProductGrid>
          <Pagination page={page} total={total} limit={filters.limit} />
        </div>
      )}
    </div>
  );
}
