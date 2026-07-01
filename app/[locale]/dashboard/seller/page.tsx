import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { ProductManager } from "@/components/catalog/ProductManager";
import { VendorMarkets } from "@/components/vendor/VendorMarkets";
import { DashboardPlaceholder } from "@/features/auth/components/DashboardPlaceholder";
import { getSessionProfile } from "@/features/auth/queries";
import { getCategories } from "@/features/catalog/categories";
import { getAttributes, getMyProducts } from "@/features/catalog/queries";
import { getMyMarkets } from "@/features/vendor/markets";

// Seller dashboard (Task 1.7). Active sellers manage their products; pending
// sellers see the approval banner only (REQ-AUTH-05). Middleware guards the route.
export default async function SellerDashboardPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const profile = await getSessionProfile();
  if (!profile) redirect(`/${params.locale}/login`);

  const isActiveSeller = profile.role === "seller" && profile.status === "active";
  const [products, categories, attributes, myMarkets] = isActiveSeller
    ? await Promise.all([
        getMyProducts(),
        getCategories({ kind: "product" }),
        getAttributes(),
        getMyMarkets(),
      ])
    : [[], [], [], []];

  const categoryOptions = categories.map((category) => ({
    value: category.id,
    label: params.locale === "ar" ? category.name_ar : category.name_en,
  }));
  const approvedMarkets = myMarkets.filter((entry) => entry.isApproved).map((entry) => entry.market);

  return (
    <DashboardPlaceholder profile={profile}>
      {isActiveSeller ? (
        <div className="flex flex-col gap-8">
          <VendorMarkets
            markets={myMarkets.map((entry) => ({ market: entry.market, isApproved: entry.isApproved }))}
          />
          <ProductManager
            products={products}
            categories={categoryOptions}
            attributes={attributes}
            markets={approvedMarkets}
          />
        </div>
      ) : null}
    </DashboardPlaceholder>
  );
}
