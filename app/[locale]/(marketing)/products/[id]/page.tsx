import type { Metadata } from "next";
import { PackageX } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProductGallery } from "@/components/catalog/ProductGallery";
import { SellerInfoCard } from "@/components/catalog/SellerInfoCard";
import { VariantSelector } from "@/components/catalog/VariantSelector";
import { MarketSwitcher } from "@/components/shared/MarketSwitcher";
import { PriceTag } from "@/components/shared/PriceTag";
import { parseProductImages } from "@/features/catalog/images";
import { getProductById, getPublicVendor } from "@/features/catalog/queries";
import { resolveReadMarket } from "@/lib/markets-server";
import { toMinor } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

type DetailParams = { locale: string; id: string };
type SearchParams = Record<string, string | string[] | undefined>;

function readMarketParam(searchParams?: SearchParams): string | null {
  return searchParams && typeof searchParams.market === "string" ? searchParams.market : null;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: DetailParams;
  searchParams?: SearchParams;
}): Promise<Metadata> {
  const market = await resolveReadMarket(readMarketParam(searchParams));
  const result = await getProductById(params.id, market);
  if (result.status !== "ok") return {};

  const { product } = result.detail;
  const cover = parseProductImages(product.images)[0];
  return {
    title: product.title,
    description: product.description ?? undefined,
    openGraph: {
      title: product.title,
      description: product.description ?? undefined,
      images: cover ? [{ url: cover.url }] : undefined,
    },
  };
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: DetailParams;
  searchParams?: SearchParams;
}) {
  setRequestLocale(params.locale);
  const market = await resolveReadMarket(readMarketParam(searchParams));
  const result = await getProductById(params.id, market);

  // Truly gone / never active → real 404. Exists but not priced here → soft page (DC-2).
  if (result.status === "not_found") notFound();
  if (result.status === "not_in_market") {
    return <ProductNotInMarket locale={params.locale} market={market} />;
  }

  const t = await getTranslations("catalog");
  const { product, variants } = result.detail;
  const images = parseProductImages(product.images);
  const vendor = await getPublicVendor(product.seller_id);

  // Product title is seller-entered free text (could be ar OR en): ar → El Messiri
  // (font-arabic), en → Marcellus (font-serif, which lacks Arabic glyphs).
  const headingFont = params.locale === "ar" ? "font-arabic font-bold" : "font-serif";

  return (
    <div className="container py-12 lg:py-16">
      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery images={images} title={product.title} />

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h1 className="text-h2 text-foreground">{product.title}</h1>
            <PriceTag
              amountMinor={toMinor(product.price, product.currency)}
              currency={product.currency}
              emphasis="detail"
            />
          </div>

          {product.description ? (
            <p className="whitespace-pre-line text-body leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          ) : null}

          <VariantSelector variants={variants} />

          {vendor ? <SellerInfoCard vendor={vendor} locale={params.locale} /> : null}
        </div>
      </div>

      <section className="mt-12 border-t border-border pt-8">
        <h2 className={cn("text-h3 text-foreground", headingFont)}>{t("reviews")}</h2>
        {/* Reviews land in Phase 5 — placeholder for now. */}
        <p className="mt-2 text-body-sm text-muted-foreground">{t("noReviews")}</p>
      </section>
    </div>
  );
}

/**
 * DC-2 soft "not available in your market" state — the product exists and is active,
 * but has no price in the active market. We show NO price (no cross-market leak) and
 * route the recovery through the normal MarketSwitcher, plus a link back to the catalog.
 * Friendlier than a hard 404 for shared links, while preserving market invisibility.
 */
async function ProductNotInMarket({ locale, market }: { locale: string; market: import("@/lib/markets").Market }) {
  const t = await getTranslations("catalog.notInMarket");
  const headingFont = locale === "ar" ? "font-arabic font-bold" : "font-serif";

  return (
    <div className="container flex min-h-[50vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <span
        className="grid h-16 w-16 place-items-center rounded-full bg-secondary text-primary"
        aria-hidden
      >
        <PackageX className="h-8 w-8" />
      </span>
      <h1 className={cn("text-h2 text-foreground", headingFont)}>{t("title")}</h1>
      <p className="max-w-prose text-body text-muted-foreground">{t("description")}</p>
      <div className="mt-2 flex flex-col items-center gap-3">
        <MarketSwitcher market={market} />
        <Link href="/products" className="text-body-sm font-medium text-primary hover:underline">
          {t("browse")}
        </Link>
      </div>
    </div>
  );
}
