"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type DefaultValues, type Resolver, useFieldArray, useForm } from "react-hook-form";

import type { CategoryOption } from "@/components/shared/FilterBar";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CURRENCY_BY_MARKET, type Market } from "@/lib/markets";
import { STORAGE_BUCKETS } from "@/lib/storage/buckets";
import { parseProductImages } from "@/features/catalog/images";
import type { AttributeView, SellerProduct } from "@/features/catalog/queries";
import { productSchema, type ProductInput } from "@/features/catalog/schema";
import { useToast } from "@/lib/hooks/use-toast";
import { useRouter } from "@/i18n/navigation";

interface ProductFormProps {
  product: SellerProduct | null; // null → create
  categories: CategoryOption[];
  /** Controlled color/size vocabulary (CR-01 §G) — sellers pick options, no free text. */
  attributes: AttributeView[];
  /** The markets the seller is APPROVED for (CR-01 §B) — one price set is rendered per market. */
  markets: Market[];
  onSuccess: () => void;
  onCancel: () => void;
}

const STATUSES = ["draft", "active", "inactive"] as const;

/** Empty number-field handler: "" ↔ undefined, otherwise the numeric value. */
const numberValue = (value: number | undefined) => (value === undefined ? "" : String(value));
const onNumberChange =
  (onChange: (value: number | undefined) => void) =>
  (event: React.ChangeEvent<HTMLInputElement>) =>
    onChange(event.target.value === "" ? undefined : event.target.valueAsNumber);

/** Build RHF defaults, ensuring exactly one price set (+ per-variant stock) per approved market. */
function buildDefaults(product: SellerProduct | null, markets: Market[]): DefaultValues<ProductInput> {
  if (!product) {
    return {
      is_rentable: false,
      images: [],
      status: "draft",
      prices: markets.map((market) => ({ market, stock: 0, is_available: true })),
      variants: [],
      attribute_option_ids: [],
    };
  }
  return {
    title: product.title,
    description: product.description ?? undefined,
    category_id: product.category_id,
    is_rentable: product.is_rentable,
    images: parseProductImages(product.images),
    status: product.status === "rejected" ? "draft" : product.status,
    prices: markets.map((market) => {
      const existing = product.product_prices.find((price) => price.market === market);
      return existing
        ? {
            market,
            price: existing.price,
            rental_daily_price: existing.rental_daily_price ?? undefined,
            security_deposit: existing.security_deposit ?? undefined,
            stock: existing.stock,
            is_available: existing.is_available,
          }
        : { market, stock: 0, is_available: true };
    }),
    variants: product.product_variants.map((variant) => ({
      id: variant.id,
      size: variant.size ?? undefined,
      color: variant.color ?? undefined,
      sku: variant.sku ?? undefined,
      stock: markets.map((market) => ({
        market,
        stock: variant.product_variant_stock.find((entry) => entry.market === market)?.stock ?? 0,
      })),
    })),
    attribute_option_ids: product.product_attributes.map((attribute) => attribute.option_id),
  };
}

export function ProductForm({
  product,
  categories,
  attributes,
  markets,
  onSuccess,
  onCancel,
}: ProductFormProps) {
  const t = useTranslations("seller.form");
  const tStatus = useTranslations("status");
  const tToast = useTranslations("seller.toast");
  const tMarket = useTranslations("market");
  const locale = useLocale();
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<ProductInput>({
    // productSchema has `.default()`/`.refine()`, so Zod's *input* type diverges from
    // `ProductInput` (the parsed output). The form is written against the output type.
    resolver: zodResolver(productSchema) as Resolver<ProductInput>,
    defaultValues: buildDefaults(product, markets),
  });

  const prices = useFieldArray({ control: form.control, name: "prices" });
  const variants = useFieldArray({ control: form.control, name: "variants" });
  const isRentable = form.watch("is_rentable");
  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: ProductInput) {
    const url = product ? `/api/products/${product.id}` : "/api/products";
    const response = await fetch(url, {
      method: product ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!response.ok) {
      toast({ variant: "destructive", description: tToast("error") });
      return;
    }
    toast({ description: product ? tToast("updated") : tToast("created") });
    router.refresh();
    onSuccess();
  }

  // No approved market → the seller cannot price anything yet (declare + get approved first).
  if (markets.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-body-sm text-muted-foreground">{t("noMarkets")}</p>
        <Button type="button" variant="outline" onClick={onCancel} className="w-fit">
          {t("cancel")}
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
        data-testid="product-form"
        noValidate
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("title")}</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} data-testid="product-title" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("description")}</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("category")}</FormLabel>
              <Select
                value={field.value ?? "none"}
                onValueChange={(value) => field.onChange(value === "none" ? null : value)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">{t("categoryNone")}</SelectItem>
                  {categories.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("status")}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger data-testid="product-status">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {tStatus(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_rentable"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("rentable")}</FormLabel>
              <Select
                value={field.value ? "yes" : "no"}
                onValueChange={(value) => field.onChange(value === "yes")}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="no">{t("no")}</SelectItem>
                  <SelectItem value="yes">{t("yes")}</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        {/* Per-market pricing (CR-01 §B) — one set per approved market; currency derived. */}
        <div className="flex flex-col gap-3">
          <span className="text-caption font-semibold text-muted-foreground">{t("pricing")}</span>
          {prices.fields.map((priceField, index) => {
            const market = priceField.market as Market;
            return (
              <div key={priceField.id} className="flex flex-col gap-3 rounded-lg border border-border p-4">
                <span className="text-caption font-semibold text-foreground">
                  {tMarket(`name.${market}`)} · {CURRENCY_BY_MARKET[market]}
                </span>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`prices.${index}.price`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("price")}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            data-testid={`product-price-${market}`}
                            value={numberValue(field.value)}
                            onChange={onNumberChange(field.onChange)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`prices.${index}.stock`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("stock")}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            data-testid={`product-stock-${market}`}
                            value={numberValue(field.value)}
                            onChange={onNumberChange(field.onChange)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {isRentable ? (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`prices.${index}.rental_daily_price`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("rentalDailyPrice")}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              value={numberValue(field.value)}
                              onChange={onNumberChange(field.onChange)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`prices.${index}.security_deposit`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("securityDeposit")}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              value={numberValue(field.value)}
                              onChange={onNumberChange(field.onChange)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ) : null}
                <FormField
                  control={form.control}
                  name={`prices.${index}.is_available`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("available")}</FormLabel>
                      <Select
                        value={field.value ? "yes" : "no"}
                        onValueChange={(value) => field.onChange(value === "yes")}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="yes">{t("yes")}</SelectItem>
                          <SelectItem value="no">{t("no")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>
            );
          })}
        </div>

        <FormField
          control={form.control}
          name="images"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("images")}</FormLabel>
              <FormControl>
                <ImageUploader
                  bucket={STORAGE_BUCKETS.products}
                  value={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {attributes.length > 0 ? (
          <FormField
            control={form.control}
            name="attribute_option_ids"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("attributes")}</FormLabel>
                <div className="flex flex-col gap-4">
                  {attributes.map((attribute) => (
                    <div key={attribute.id} className="flex flex-col gap-2">
                      <span className="text-caption text-muted-foreground">
                        {locale === "ar" ? attribute.keyAr : attribute.keyEn}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {attribute.options.map((option) => {
                          const selected = field.value.includes(option.id);
                          return (
                            <Button
                              key={option.id}
                              type="button"
                              size="sm"
                              variant={selected ? "default" : "outline"}
                              aria-pressed={selected}
                              onClick={() =>
                                field.onChange(
                                  selected
                                    ? field.value.filter((id: string) => id !== option.id)
                                    : [...field.value, option.id],
                                )
                              }
                            >
                              {locale === "ar" ? option.valueAr : option.valueEn}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-caption font-semibold text-muted-foreground">{t("variants")}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                variants.append({
                  size: "",
                  color: "",
                  sku: "",
                  stock: markets.map((market) => ({ market, stock: 0 })),
                })
              }
            >
              <Plus className="h-4 w-4" aria-hidden />
              {t("addVariant")}
            </Button>
          </div>
          {variants.fields.map((row, index) => (
            <div key={row.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <div className="flex items-end gap-2">
                <FormField
                  control={form.control}
                  name={`variants.${index}.size`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className="text-caption">{t("size")}</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`variants.${index}.color`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className="text-caption">{t("color")}</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 text-muted-foreground hover:text-destructive"
                  onClick={() => variants.remove(index)}
                  aria-label={t("removeVariant")}
                >
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              {/* Per-market stock for this variant (Q-B1). */}
              <div className="grid grid-cols-2 gap-2">
                {markets.map((market, marketIndex) => (
                  <FormField
                    key={market}
                    control={form.control}
                    name={`variants.${index}.stock.${marketIndex}.stock`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-caption">
                          {t("variantStock")} · {tMarket(`name.${market}`)}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            value={numberValue(field.value)}
                            onChange={onNumberChange(field.onChange)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            data-testid="product-submit"
            className="shadow-soft"
          >
            {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {t("save")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
