import { Heart, ImageOff, Star } from "lucide-react";
import Image from "next/image";

import { PriceTag } from "@/components/shared/PriceTag";
import { parseProductImages } from "@/features/catalog/images";
import type { MarketProduct } from "@/features/catalog/queries";
import { toMinor } from "@/lib/money";
import { Link } from "@/i18n/navigation";

interface ProductCardProps {
  product: MarketProduct;
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
        {/* Wishlist heart — DECORATIVE placeholder (favorites is a later feature; no
            behavior wired). Rendered as a span (not a button) so it doesn't nest an
            interactive control inside the card link. */}
        <span
          aria-hidden
          className="absolute end-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-card/80 text-muted-foreground shadow-soft backdrop-blur-sm"
        >
          <Heart className="h-4 w-4" />
        </span>
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
        {/* Star rating — DECORATIVE placeholder until reviews ship (Phase 5). */}
        <span className="mt-1 flex gap-0.5" aria-hidden>
          {Array.from({ length: 5 }, (_, index) => (
            <Star key={index} className="h-3.5 w-3.5 text-mist" />
          ))}
        </span>
      </div>
    </Link>
  );
}
