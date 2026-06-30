"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type Resolver, useFieldArray, useForm } from "react-hook-form";

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
import { STORAGE_BUCKETS } from "@/lib/storage/buckets";
import { parseProductImages } from "@/features/catalog/images";
import type { SellerProduct } from "@/features/catalog/queries";
import { productSchema, type ProductInput } from "@/features/catalog/schema";
import { useToast } from "@/lib/hooks/use-toast";
import { useRouter } from "@/i18n/navigation";

interface ProductFormProps {
  product: SellerProduct | null; // null → create
  categories: CategoryOption[];
  onSuccess: () => void;
  onCancel: () => void;
}

const STATUSES = ["draft", "active", "inactive"] as const;
const CURRENCIES = ["SAR", "EGP"] as const;

/** Empty number-field handler: "" ↔ undefined, otherwise the numeric value. */
const numberValue = (value: number | undefined) => (value === undefined ? "" : String(value));
const onNumberChange =
  (onChange: (value: number | undefined) => void) =>
  (event: React.ChangeEvent<HTMLInputElement>) =>
    onChange(event.target.value === "" ? undefined : event.target.valueAsNumber);

export function ProductForm({ product, categories, onSuccess, onCancel }: ProductFormProps) {
  const t = useTranslations("seller.form");
  const tStatus = useTranslations("status");
  const tToast = useTranslations("seller.toast");
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<ProductInput>({
    // productSchema has `.default()`/`.refine()`, so Zod's *input* type (defaulted
    // fields optional) diverges from `ProductInput` (the parsed output). The form is
    // written against the output type, so assert the resolver to it.
    resolver: zodResolver(productSchema) as Resolver<ProductInput>,
    defaultValues: product
      ? {
          title: product.title,
          description: product.description ?? undefined,
          category_id: product.category_id,
          price: product.price,
          currency: product.currency,
          is_rentable: product.is_rentable,
          rental_daily_price: product.rental_daily_price ?? undefined,
          security_deposit: product.security_deposit ?? undefined,
          images: parseProductImages(product.images),
          stock: product.stock,
          status: product.status === "rejected" ? "draft" : product.status,
          variants: product.product_variants.map((v) => ({
            id: v.id,
            size: v.size ?? undefined,
            color: v.color ?? undefined,
            stock: v.stock,
            sku: v.sku ?? undefined,
          })),
        }
      : { currency: "SAR", status: "draft", is_rentable: false, images: [], variants: [] },
  });

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

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("price")}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    data-testid="product-price"
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
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("currency")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CURRENCIES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="stock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("stock")}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    data-testid="product-stock"
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
        </div>

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

        {isRentable ? (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="rental_daily_price"
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
              name="security_deposit"
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

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-caption font-semibold text-muted-foreground">{t("variants")}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => variants.append({ size: "", color: "", stock: 0, sku: "" })}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {t("addVariant")}
            </Button>
          </div>
          {variants.fields.map((row, index) => (
            <div key={row.id} className="flex items-end gap-2">
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
              <FormField
                control={form.control}
                name={`variants.${index}.stock`}
                render={({ field }) => (
                  <FormItem className="w-20">
                    <FormLabel className="text-caption">{t("variantStock")}</FormLabel>
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
