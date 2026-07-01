"use client";

import { ImageOff, PackageSearch, Pencil, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ProductForm } from "@/components/catalog/ProductForm";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { type Column, DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import type { CategoryOption } from "@/components/shared/FilterBar";
import { PriceTag } from "@/components/shared/PriceTag";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { parseProductImages } from "@/features/catalog/images";
import type { AttributeView, SellerProduct } from "@/features/catalog/queries";
import type { Market } from "@/lib/markets";
import { toMinor } from "@/lib/money";
import { useToast } from "@/lib/hooks/use-toast";
import { useRouter } from "@/i18n/navigation";

interface ProductManagerProps {
  products: SellerProduct[];
  categories: CategoryOption[];
  attributes: AttributeView[];
  /** The seller's APPROVED markets — drive the per-market price sets in the form. */
  markets: Market[];
}

/** Seller product management (COMPONENT_TREE; USER_FLOWS §11) — own products only. */
export function ProductManager({ products, categories, attributes, markets }: ProductManagerProps) {
  const t = useTranslations("seller");
  const tToast = useTranslations("seller.toast");
  const locale = useLocale();
  const { toast } = useToast();
  const router = useRouter();

  const [editing, setEditing] = useState<SellerProduct | "new" | null>(null);
  const [deleting, setDeleting] = useState<SellerProduct | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const formProduct = editing === "new" ? null : editing;

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    const response = await fetch(`/api/products/${deleting.id}`, { method: "DELETE" });
    setDeletePending(false);
    if (!response.ok) {
      toast({ variant: "destructive", description: tToast("error") });
      return;
    }
    toast({ description: tToast("deleted") });
    setDeleting(null);
    router.refresh();
  }

  const columns: Column<SellerProduct>[] = [
    {
      id: "image",
      header: t("col.image"),
      cell: (product) => {
        const cover = parseProductImages(product.images)[0];
        return (
          <div className="relative h-12 w-12 overflow-hidden rounded-md bg-muted">
            {cover ? (
              <Image src={cover.url} alt="" fill sizes="48px" className="object-cover" />
            ) : (
              <span className="grid h-full w-full place-items-center text-mist" aria-hidden>
                <ImageOff className="h-5 w-5" />
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "title",
      header: t("col.title"),
      cell: (product) => <span className="font-medium text-foreground">{product.title}</span>,
    },
    {
      id: "price",
      header: t("col.price"),
      align: "end",
      cell: (product) =>
        product.product_prices.length > 0 ? (
          <div className="flex flex-col items-end gap-0.5">
            {product.product_prices.map((price) => (
              <PriceTag
                key={price.id}
                amountMinor={toMinor(price.price, price.currency)}
                currency={price.currency}
              />
            ))}
          </div>
        ) : (
          <span className="text-mist">—</span>
        ),
    },
    {
      id: "stock",
      header: t("col.stock"),
      align: "end",
      cell: (product) => {
        const hasVariants = product.product_variants.length > 0;
        const stockFor = (market: Market) =>
          hasVariants
            ? product.product_variants.reduce(
                (sum, variant) =>
                  sum + (variant.product_variant_stock.find((s) => s.market === market)?.stock ?? 0),
                0,
              )
            : (product.product_prices.find((price) => price.market === market)?.stock ?? 0);
        return product.product_prices.length > 0 ? (
          <div className="flex flex-col items-end gap-0.5 tabular-nums">
            {product.product_prices.map((price) => (
              <span key={price.id} className="text-body-sm">
                {price.market} {stockFor(price.market)}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-mist">—</span>
        );
      },
    },
    {
      id: "status",
      header: t("col.status"),
      cell: (product) => <StatusBadge status={product.status} />,
    },
    {
      id: "actions",
      header: t("col.actions"),
      align: "end",
      cell: (product) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setEditing(product)}
            aria-label={t("edit")}
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-destructive"
            onClick={() => setDeleting(product)}
            aria-label={t("delete")}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6" data-testid="product-manager">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-h3 text-foreground">{t("products")}</h2>
        <Button
          type="button"
          onClick={() => setEditing("new")}
          data-testid="add-product"
          className="shadow-soft"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t("addProduct")}
        </Button>
      </div>

      <DataTable<SellerProduct>
        columns={columns}
        rows={products}
        getRowId={(product) => product.id}
        emptyState={
          <EmptyState
            icon={PackageSearch}
            title={t("noProductsTitle")}
            description={t("noProductsHint")}
            action={
              <Button type="button" onClick={() => setEditing("new")}>
                {t("addProduct")}
              </Button>
            }
          />
        }
      />

      <Sheet
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <SheetContent
          side={locale === "ar" ? "left" : "right"}
          className="w-full overflow-y-auto sm:max-w-xl"
        >
          <SheetHeader className="text-start">
            <SheetTitle>{formProduct ? t("form.editTitle") : t("form.newTitle")}</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            {editing !== null ? (
              <ProductForm
                product={formProduct}
                categories={categories}
                attributes={attributes}
                markets={markets}
                onSuccess={() => setEditing(null)}
                onCancel={() => setEditing(null)}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t("deleteTitle")}
        description={deleting ? t("deleteBody", { title: deleting.title }) : undefined}
        confirmLabel={t("deleteConfirm")}
        cancelLabel={t("form.cancel")}
        onConfirm={confirmDelete}
        destructive
        pending={deletePending}
      />
    </div>
  );
}
