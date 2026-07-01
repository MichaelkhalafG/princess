"use client";

import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { type Column, DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AttributeView } from "@/features/catalog/queries";
import { useToast } from "@/lib/hooks/use-toast";
import { useRouter } from "@/i18n/navigation";

interface AttributeManagerProps {
  initialAttributes: AttributeView[];
}

interface OptionRow {
  id: string;
  attributeLabel: string;
  valueEn: string;
  valueAr: string;
  slug: string;
}

/**
 * Minimal admin panel for the controlled attribute vocabulary (CR-01 §G, REQ-DASH-05):
 * lists color/size options in a DataTable and adds new options via `PUT /api/admin/attributes`
 * (service-role). Definitions themselves are seeded by migration 0008; this manages their
 * options — the common day-to-day edit. All copy via messages/*.
 */
export function AttributeManager({ initialAttributes }: AttributeManagerProps) {
  const t = useTranslations("adminAttributes");
  const locale = useLocale();
  const { toast } = useToast();
  const router = useRouter();

  const [attributes, setAttributes] = useState<AttributeView[]>(initialAttributes);
  const [attributeId, setAttributeId] = useState<string>(initialAttributes[0]?.id ?? "");
  const [valueEn, setValueEn] = useState("");
  const [valueAr, setValueAr] = useState("");
  const [slug, setSlug] = useState("");
  const [pending, setPending] = useState(false);

  const rows: OptionRow[] = attributes.flatMap((attribute) =>
    attribute.options.map((option) => ({
      id: option.id,
      attributeLabel: locale === "ar" ? attribute.keyAr : attribute.keyEn,
      valueEn: option.valueEn,
      valueAr: option.valueAr,
      slug: option.slug,
    })),
  );

  const columns: Column<OptionRow>[] = [
    { id: "attribute", header: t("attribute"), cell: (row) => row.attributeLabel },
    { id: "valueEn", header: t("valueEn"), cell: (row) => row.valueEn },
    { id: "valueAr", header: t("valueAr"), cell: (row) => row.valueAr },
    {
      id: "slug",
      header: t("slug"),
      cell: (row) => <code className="text-caption text-muted-foreground">{row.slug}</code>,
    },
  ];

  const canSubmit = attributeId !== "" && valueEn.trim() && valueAr.trim() && slug.trim() && !pending;

  async function addOption() {
    if (!canSubmit) return;
    setPending(true);
    const response = await fetch("/api/admin/attributes", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        options: [{ attribute_id: attributeId, value_en: valueEn.trim(), value_ar: valueAr.trim(), slug: slug.trim() }],
      }),
    });
    setPending(false);
    if (!response.ok) {
      toast({ variant: "destructive", description: t("error") });
      return;
    }
    const body: { data?: { attributes?: AttributeView[] } } = await response.json();
    if (body.data?.attributes) setAttributes(body.data.attributes);
    setValueEn("");
    setValueAr("");
    setSlug("");
    toast({ description: t("saved") });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-h3 text-foreground">{t("title")}</h2>
        <p className="text-body-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <span className="text-caption font-semibold text-muted-foreground">{t("addTitle")}</span>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={attributeId} onValueChange={setAttributeId}>
            <SelectTrigger aria-label={t("attribute")} className="h-11 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {attributes.map((attribute) => (
                <SelectItem key={attribute.id} value={attribute.id}>
                  {locale === "ar" ? attribute.keyAr : attribute.keyEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            aria-label={t("valueEn")}
            placeholder={t("valueEn")}
            value={valueEn}
            onChange={(event) => setValueEn(event.target.value)}
            className="h-11"
          />
          <Input
            aria-label={t("valueAr")}
            placeholder={t("valueAr")}
            value={valueAr}
            onChange={(event) => setValueAr(event.target.value)}
            className="h-11"
          />
          <Input
            aria-label={t("slug")}
            placeholder={t("slug")}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            className="h-11"
          />
        </div>
        <Button type="button" onClick={addOption} disabled={!canSubmit} className="w-fit shadow-soft">
          <Plus className="h-4 w-4" aria-hidden />
          {t("add")}
        </Button>
      </div>

      <DataTable<OptionRow> columns={columns} rows={rows} getRowId={(row) => row.id} />
    </div>
  );
}
