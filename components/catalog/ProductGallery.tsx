"use client";

import { ImageOff } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { CatalogImage } from "@/features/catalog/images";
import { cn } from "@/lib/utils";

interface ProductGalleryProps {
  images: CatalogImage[];
  title: string;
}

/**
 * Detail gallery — main image + thumbnail strip (DESIGN_RULES §9; reused by
 * services/planner). next/image with fixed aspect ratio (zero CLS). Thumbnails are
 * real buttons (keyboard + focus), `aria-current` marks the active one. RTL-safe.
 */
export function ProductGallery({ images, title }: ProductGalleryProps) {
  const t = useTranslations("catalog");
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div
        className="grid aspect-[4/5] w-full place-items-center rounded-lg border border-border bg-muted text-mist"
        aria-hidden
      >
        <ImageOff className="h-10 w-10" />
      </div>
    );
  }

  const current = images[Math.min(active, images.length - 1)] ?? images[0];
  if (!current) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg border border-border bg-muted">
        <Image
          src={current.url}
          alt={current.alt || title}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />
      </div>

      {images.length > 1 ? (
        <ul className="flex flex-wrap gap-3" role="list">
          {images.map((image, index) => (
            <li key={image.url}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-current={index === active}
                aria-label={t("viewImage", { number: index + 1 })}
                className={cn(
                  "relative aspect-square w-16 overflow-hidden rounded-md border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  index === active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50",
                )}
              >
                <Image src={image.url} alt="" fill sizes="64px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
