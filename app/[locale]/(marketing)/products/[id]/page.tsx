import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProductGallery } from "@/components/catalog/ProductGallery";
import { VariantSelector } from "@/components/catalog/VariantSelector";
import { PriceTag } from "@/components/shared/PriceTag";
import { parseProductImages } from "@/features/catalog/images";
import { getProductById } from "@/features/catalog/queries";
import { toMinor } from "@/lib/money";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: { locale: string; id: string };
}): Promise<Metadata> {
  const detail = await getProductById(params.id);
  if (!detail) return {};
  const cover = parseProductImages(detail.product.images)[0];
  return {
    title: detail.product.title,
    description: detail.product.description ?? undefined,
    openGraph: {
      title: detail.product.title,
      description: detail.product.description ?? undefined,
      images: cover ? [{ url: cover.url }] : undefined,
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  setRequestLocale(params.locale);
  const detail = await getProductById(params.id);
  if (!detail) notFound();

  const t = await getTranslations("catalog");
  const { product, variants } = detail;
  const images = parseProductImages(product.images);

  // Product title is seller-entered free text (could be ar OR en) → sans (which
  // includes the Arabic fallback), never serif (Playfair lacks Arabic glyphs).
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
