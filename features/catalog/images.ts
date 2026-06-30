import type { Json } from "@/lib/database.types";

/** A product image as stored in `products.images` jsonb (matches ImageUploader output). */
export interface CatalogImage {
  url: string;
  alt: string;
  sort: number;
}

/**
 * Safely parse the `products.images` jsonb (typed `Json`) into ordered images.
 * Tolerates malformed entries (no `any` — narrows `unknown`). Reused by ProductCard
 * + ProductGallery.
 */
export function parseProductImages(images: Json): CatalogImage[] {
  if (!Array.isArray(images)) return [];

  const parsed: CatalogImage[] = [];
  images.forEach((entry, index) => {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const record = entry as Record<string, unknown>;
      if (typeof record.url === "string") {
        parsed.push({
          url: record.url,
          alt: typeof record.alt === "string" ? record.alt : "",
          sort: typeof record.sort === "number" ? record.sort : index,
        });
      }
    }
  });

  return parsed.sort((a, b) => a.sort - b.sort);
}
