"use client";

import { useState } from "react";

import { ImageUploader, type UploadedImage } from "@/components/shared/ImageUploader";
import { STORAGE_BUCKETS } from "@/lib/storage/buckets";

// THROWAWAY dev harness — holds ImageUploader state and dumps the emitted
// {url,alt,sort} shape so you can eyeball the result. Delete with the dev/ folder.
export function UploadTestHarness() {
  const [images, setImages] = useState<UploadedImage[]>([]);

  return (
    <div className="flex flex-col gap-4">
      <ImageUploader bucket={STORAGE_BUCKETS.products} value={images} onChange={setImages} />
      <pre className="overflow-auto rounded-md border border-border bg-card p-4 text-caption text-muted-foreground">
        {JSON.stringify(images, null, 2)}
      </pre>
    </div>
  );
}
