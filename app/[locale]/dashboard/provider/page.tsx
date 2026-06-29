import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { DashboardPlaceholder } from "@/features/auth/components/DashboardPlaceholder";
import { getSessionProfile } from "@/features/auth/queries";

// Provider dashboard landing (Task 0.7). Pending providers see the approval
// banner (REQ-AUTH-05). Full ServiceManager/BookingManager arrive later.
export default async function ProviderDashboardPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const profile = await getSessionProfile();
  if (!profile) redirect(`/${params.locale}/login`);

  return <DashboardPlaceholder profile={profile} />;
}
