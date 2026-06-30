import { PackageSearch } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ProductCard } from "@/components/catalog/ProductCard";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { listProducts } from "@/features/catalog/queries";
import type { ProductFilters } from "@/features/catalog/schema";

interface ProductResultsProps {
  filters: ProductFilters;
  categoryOptions: { value: string; label: string }[];
}

/**
 * Async results region — awaited inside <Suspense> on the list page so the
 * skeleton shows while it fetches (no CLS). Server component (no client waterfall).
 */
export async function ProductResults({ filters, categoryOptions }: ProductResultsProps) {
  const t = await getTranslations("products");
  const { items, total, page } = await listProducts(filters);

  if (items.length === 0) {
    return <EmptyState icon={PackageSearch} title={t("empty")} />;
  }

  const labelById = new Map(categoryOptions.map((option) => [option.value, option.label]));

  return (
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
  );
}
