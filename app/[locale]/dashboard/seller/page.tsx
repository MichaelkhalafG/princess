import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { DashboardPlaceholder } from "@/features/auth/components/DashboardPlaceholder";
import { getSessionProfile } from "@/features/auth/queries";

// Seller dashboard landing (Task 0.7). Pending sellers see the approval banner
// (REQ-AUTH-05). Full ProductManager/OrderManager arrive in later phases.
export default async function SellerDashboardPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const profile = await getSessionProfile();
  if (!profile) redirect(`/${params.locale}/login`);

  return <DashboardPlaceholder profile={profile} />;
}
