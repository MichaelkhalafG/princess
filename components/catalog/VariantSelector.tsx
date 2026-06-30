"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ProductVariant } from "@/features/catalog/queries";

interface VariantSelectorProps {
  variants: ProductVariant[];
}

function distinct(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => v !== null && v !== "")));
}

/**
 * Variant picker (size/color) — pure display + local selection. Add-to-cart is
 * Phase 2, so the action renders as a disabled placeholder. RTL-safe; messages-only.
 */
export function VariantSelector({ variants }: VariantSelectorProps) {
  const t = useTranslations("catalog");
  const sizes = distinct(variants.map((v) => v.size));
  const colors = distinct(variants.map((v) => v.color));

  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      {sizes.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-caption font-medium text-muted-foreground">{t("size")}</span>
          <div className="flex flex-wrap gap-2">
            {sizes.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={size === value ? "default" : "outline"}
                onClick={() => setSize((prev) => (prev === value ? null : value))}
              >
                {value}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {colors.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-caption font-medium text-muted-foreground">{t("color")}</span>
          <div className="flex flex-wrap gap-2">
            {colors.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={color === value ? "default" : "outline"}
                onClick={() => setColor((prev) => (prev === value ? null : value))}
              >
                {value}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Add-to-cart is Phase 2 — placeholder, disabled for now. */}
      <Button type="button" disabled className="h-12 w-full rounded-full shadow-soft">
        {t("addToCart")}
      </Button>
    </div>
  );
}
