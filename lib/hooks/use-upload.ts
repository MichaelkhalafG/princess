"use client";

import { useState } from "react";

import type { ApiEnvelope } from "@/lib/api";
import type { StorageBucket } from "@/lib/storage/buckets";

export interface UploadedItem {
  url: string;
  path: string;
}

interface UploadResponse {
  urls: string[];
  items: UploadedItem[];
}

/**
 * Client hook around `POST /api/upload` (Decision D3). Posts multipart form-data;
 * the server enforces auth + validation + Storage RLS. Returns the uploaded items
 * or `null` on failure, with `isUploading` + an `error` code for the UI to localize.
 *
 * Note: `fetch` has no native upload-progress; granular progress would need XHR —
 * deferred. `isUploading` covers the spinner state.
 */
export function useUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: File[], bucket: StorageBucket): Promise<UploadedItem[] | null> {
    setIsUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("bucket", bucket);
      for (const file of files) form.append("files", file);

      const response = await fetch("/api/upload", { method: "POST", body: form });
      const json = (await response.json()) as ApiEnvelope<UploadResponse>;

      if (!response.ok || "error" in json) {
        setError("error" in json ? json.error.code : "INTERNAL");
        return null;
      }
      return json.data.items;
    } catch {
      setError("INTERNAL");
      return null;
    } finally {
      setIsUploading(false);
    }
  }

  return { upload, isUploading, error };
}
