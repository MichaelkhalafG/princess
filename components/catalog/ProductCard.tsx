import { ImageOff } from "lucide-react";
import Image from "next/image";

import { PriceTag } from "@/components/shared/PriceTag";
import { parseProductImages } from "@/features/catalog/images";
import type { Product } from "@/features/catalog/queries";
import { toMinor } from "@/lib/money";
import { Link } from "@/i18n/navigation";

interface ProductCardProps {
  product: Product;
  /** Locale-resolved category name (from the page). */
  categoryLabel?: string;
}

/**
 * Catalog product card (DESIGN_RULES §5/§9 — image-forward, Zara-elegant). Media →
 * (category) → title → price; bg-card, hairline border, radius-lg, shadow-soft;
 * hover lifts + image scales (§5/§7). next/image with a fixed aspect ratio (zero
 * CLS, §11). The whole card links to the detail page. RTL via logical layout.
 */
export function ProductCard({ product, categoryLabel }: ProductCardProps) {
  const cover = parseProductImages(product.images)[0];

  return (
    <Link
      href={`/products/${product.id}`}
      data-testid="product-card"
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-raised motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        {cover ? (
          <Image
            src={cover.url}
            alt={cover.alt || product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-mist" aria-hidden>
            <ImageOff className="h-8 w-8" />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        {categoryLabel ? (
          <span className="text-caption uppercase tracking-wide text-muted-foreground">
            {categoryLabel}
          </span>
        ) : null}
        <p className="line-clamp-1 text-body font-medium text-foreground">{product.title}</p>
        <PriceTag
          amountMinor={toMinor(product.price, product.currency)}
          currency={product.currency}
          className="mt-1"
        />
      </div>
    </Link>
  );
}
