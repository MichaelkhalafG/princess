import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { DashboardPlaceholder } from "@/features/auth/components/DashboardPlaceholder";
import { getSessionProfile } from "@/features/auth/queries";

// Customer dashboard landing (Task 0.7). Middleware guards this route; the
// profile fetch is defense-in-depth and supplies the greeting.
export default async function CustomerDashboardPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const profile = await getSessionProfile();
  if (!profile) redirect(`/${params.locale}/login`);

  return <DashboardPlaceholder profile={profile} />;
}
