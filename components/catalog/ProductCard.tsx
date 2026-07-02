import { Heart, ImageOff, Plus, Repeat, Star } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { PriceTag } from "@/components/shared/PriceTag";
import { parseProductImages } from "@/features/catalog/images";
import type { MarketProduct } from "@/features/catalog/queries";
import { toMinor } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

interface ProductCardProps {
  product: MarketProduct;
  /** Locale-resolved category name (from the page) — shown as the brand/eyebrow line. */
  categoryLabel?: string;
}

/** A product is "new" for this window after creation (drives the `new` badge). */
const NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const badgeBase =
  "absolute start-3 top-3 inline-flex h-[25px] items-center gap-[5px] rounded-full px-2.5 text-[10.5px] font-bold tracking-[0.02em] backdrop-blur-sm rtl:text-[11.5px]";

/**
 * Catalog product card — Direction A "Boutique Sidebar" (DESIGN_RULES §5/§9): portrait
 * 3:4 media, soft lift on hover, one top-start badge, decorative wishlist + star + add
 * placeholders, serif price. The whole card is the detail link. Semantic tokens only;
 * RTL via logical properties. Market pricing + `product-card` testid are preserved from
 * Tasks 1.5.3–1.5.4; the heart, stars, and Add pill are placeholder-only (cart = Phase 2).
 */
export async function ProductCard({ product, categoryLabel }: ProductCardProps) {
  const t = await getTranslations("catalog");
  const cover = parseProductImages(product.images)[0];

  // One badge per card, priority rentable > verified > new. `verified` needs the seller's
  // is_verified (not in the list query — Phase 1.6), so it's omitted until then; `rentable`
  // is real (products.is_rentable), `new` is derived from created_at.
  const isRentable = product.is_rentable;
  const isNew = !isRentable && Date.now() - new Date(product.created_at).getTime() < NEW_WINDOW_MS;

  return (
    <Link
      href={`/products/${product.id}`}
      data-testid="product-card"
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-soft transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1.5 hover:border-accent hover:shadow-raised motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
        {cover ? (
          <Image
            src={cover.url}
            alt={cover.alt || product.title}
            fill
            sizes="(max-width: 560px) 50vw, (max-width: 1180px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-mist" aria-hidden>
            <ImageOff className="h-10 w-10 opacity-60" />
          </span>
        )}

        {/* One priority badge (top-start), flips to top-end in RTL via logical props.
            rentable = ivory/90 + rose-gold-deep + inset ring; new = plum-ink + ivory (text-only). */}
        {isRentable ? (
          <span className={cn(badgeBase, "bg-background/90 text-primary-deep ring-1 ring-inset ring-border")}>
            <Repeat className="h-3 w-3" aria-hidden />
            {t("badge.rentable")}
          </span>
        ) : isNew ? (
          <span className={cn(badgeBase, "bg-foreground text-background")}>{t("badge.new")}</span>
        ) : null}

        {/* Wishlist heart — DECORATIVE placeholder (favorites is a later feature; no
            behavior). A span (not a button) so it doesn't nest interactivity in the link. */}
        <span
          aria-hidden
          className="absolute end-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full bg-card/80 text-muted-foreground shadow-soft backdrop-blur-sm transition-colors group-hover:text-primary"
        >
          <Heart className="h-4 w-4" />
        </span>
      </div>

      <div className="flex flex-1 flex-col px-[14px] pb-4 pt-[15px]">
        {categoryLabel ? (
          <span className="mb-[7px] text-[11px] font-semibold uppercase tracking-[0.12em] text-mist">
            {categoryLabel}
          </span>
        ) : null}
        <p className="line-clamp-2 text-[15px] leading-[1.35] text-foreground">{product.title}</p>

        {/* Star rating — DECORATIVE placeholder until reviews ship (Phase 5). */}
        <span className="mt-2 flex gap-0.5" aria-hidden>
          {Array.from({ length: 5 }, (_, index) => (
            <Star key={index} className="h-3.5 w-3.5 text-mist" />
          ))}
        </span>

        {/* Footer sits at the card bottom (mt-auto). MOBILE: stacked — price then a
            full-width action below it (no side-by-side collision in narrow cards).
            sm+: reference single row (.pcard__foot) — price start / action end. */}
        <div className="mt-auto flex flex-col gap-2 pt-3.5 sm:flex-row sm:items-center sm:justify-between">
          <PriceTag
            amountMinor={toMinor(product.price, product.currency)}
            currency={product.currency}
            emphasis="card"
            className="min-w-0 whitespace-nowrap"
          />
          {/* Add/Book action — DECORATIVE placeholder (cart/booking is Phase 2). A span,
              not a button, since it sits inside the card's detail link and does nothing yet.
              Peach-soft + rose-gold-deep at rest; fills rose-gold + white on card hover. */}
          <span
            aria-hidden
            className="inline-flex h-9 w-full shrink-0 items-center justify-center gap-1 rounded-full border border-border bg-muted px-[13px] text-[12.5px] font-semibold text-primary-deep transition-colors group-hover:border-transparent group-hover:bg-primary group-hover:text-primary-foreground sm:w-auto sm:justify-start"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("add")}
          </span>
        </div>
      </div>
    </Link>
  );
}
