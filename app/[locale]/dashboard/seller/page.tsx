import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { ProductManager } from "@/components/catalog/ProductManager";
import { DashboardPlaceholder } from "@/features/auth/components/DashboardPlaceholder";
import { getSessionProfile } from "@/features/auth/queries";
import { getCategories } from "@/features/catalog/categories";
import { getMyProducts } from "@/features/catalog/queries";

// Seller dashboard (Task 1.7). Active sellers manage their products; pending
// sellers see the approval banner only (REQ-AUTH-05). Middleware guards the route.
export default async function SellerDashboardPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const profile = await getSessionProfile();
  if (!profile) redirect(`/${params.locale}/login`);

  const isActiveSeller = profile.role === "seller" && profile.status === "active";
  const [products, categories] = isActiveSeller
    ? await Promise.all([getMyProducts(), getCategories({ kind: "product" })])
    : [[], []];

  const categoryOptions = categories.map((category) => ({
    value: category.id,
    label: params.locale === "ar" ? category.name_ar : category.name_en,
  }));

  return (
    <DashboardPlaceholder profile={profile}>
      {isActiveSeller ? <ProductManager products={products} categories={categoryOptions} /> : null}
    </DashboardPlaceholder>
  );
}
