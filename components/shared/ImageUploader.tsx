"use client";

import { ChevronDown, ChevronUp, ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { type DragEvent, useRef } from "react";

import { Button } from "@/components/ui/button";
import { PRODUCT_IMAGE_LIMITS, PRODUCT_IMAGE_MAX_MB } from "@/lib/constants";
import { useToast } from "@/lib/hooks/use-toast";
import { useUpload } from "@/lib/hooks/use-upload";
import type { StorageBucket } from "@/lib/storage/buckets";
import { cn } from "@/lib/utils";

/** Ordered image as persisted onto `products.images` (and reused for services/portfolio). */
export interface UploadedImage {
  url: string;
  alt: string;
  sort: number;
}

interface ImageUploaderProps {
  bucket: StorageBucket;
  value: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  /** Defaults to the single source (`PRODUCT_IMAGE_LIMITS.maxCount`). */
  maxCount?: number;
  disabled?: boolean;
}

const ACCEPT = PRODUCT_IMAGE_LIMITS.allowedMime.join(",");

/**
 * Reusable, bucket-parametrized image uploader (COMPONENT_TREE Reuse map — reused
 * by products/services/portfolio/avatars). Drag-drop or pick → validates against
 * `PRODUCT_IMAGE_LIMITS` client-side (mirrors the server) → uploads via `useUpload`
 * (RLS-enforced) → emits the ordered `{url,alt,sort}` shape. next/image previews
 * with a fixed aspect ratio (zero CLS). All copy from messages/*; RTL-safe.
 */
export function ImageUploader({
  bucket,
  value,
  onChange,
  maxCount = PRODUCT_IMAGE_LIMITS.maxCount,
  disabled,
}: ImageUploaderProps) {
  const t = useTranslations("upload");
  const { toast } = useToast();
  const { upload, isUploading } = useUpload();
  const inputRef = useRef<HTMLInputElement>(null);

  const isFull = value.length >= maxCount;
  const busy = Boolean(disabled) || isUploading;

  const resort = (images: UploadedImage[]): UploadedImage[] =>
    images.map((img, index) => ({ ...img, sort: index }));

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const allowed: readonly string[] = PRODUCT_IMAGE_LIMITS.allowedMime;
    const remaining = maxCount - value.length;
    const accepted: File[] = [];

    for (const file of Array.from(fileList)) {
      if (accepted.length >= remaining) {
        toast({ variant: "destructive", description: t("maxReached", { max: maxCount }) });
        break;
      }
      if (!allowed.includes(file.type)) {
        toast({ variant: "destructive", description: t("badType", { name: file.name }) });
        continue;
      }
      if (file.size > PRODUCT_IMAGE_LIMITS.maxSizeBytes) {
        toast({
          variant: "destructive",
          description: t("tooLarge", { name: file.name, size: PRODUCT_IMAGE_MAX_MB }),
        });
        continue;
      }
      accepted.push(file);
    }

    if (accepted.length === 0) return;
    const items = await upload(accepted, bucket);
    if (!items) {
      toast({ variant: "destructive", description: t("failed") });
      return;
    }
    const added: UploadedImage[] = items.map((item) => ({ url: item.url, alt: "", sort: 0 }));
    onChange(resort([...value, ...added]));
  }

  function remove(index: number) {
    onChange(resort(value.filter((_, i) => i !== index)));
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const moved = next.splice(from, 1)[0];
    if (!moved) return;
    next.splice(to, 0, moved);
    onChange(resort(next));
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (busy || isFull) return;
    void handleFiles(event.dataTransfer.files);
  }

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {value.map((img, index) => (
            <li
              key={img.url}
              className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted"
            >
              <Image
                src={img.url}
                alt={img.alt}
                fill
                sizes="(max-width: 640px) 33vw, 160px"
                className="object-cover"
              />
              {index === 0 ? (
                <span className="absolute start-1 top-1 rounded-sm bg-primary px-2 py-1 text-caption leading-none text-primary-foreground shadow-soft">
                  {t("cover")}
                </span>
              ) : null}
              <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8"
                    disabled={busy || index === 0}
                    onClick={() => move(index, index - 1)}
                    aria-label={t("moveEarlier")}
                  >
                    <ChevronUp aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8"
                    disabled={busy || index === value.length - 1}
                    onClick={() => move(index, index + 1)}
                    aria-label={t("moveLater")}
                  >
                    <ChevronDown aria-hidden />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8"
                  disabled={busy}
                  onClick={() => remove(index)}
                  aria-label={t("remove")}
                >
                  <X aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {!isFull ? (
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-input bg-card px-6 py-8 text-center",
            busy && "opacity-60",
          )}
        >
          <span
            className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-primary"
            aria-hidden
          >
            {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          </span>
          <p className="text-body-sm text-foreground">{isUploading ? t("uploading") : t("dropHint")}</p>
          <p className="text-caption text-muted-foreground">
            {t("hint", { max: maxCount, size: PRODUCT_IMAGE_MAX_MB })}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-1"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {t("addImages")}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            disabled={busy}
            onChange={(event) => {
              void handleFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
