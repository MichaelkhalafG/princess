import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { DashboardPlaceholder } from "@/features/auth/components/DashboardPlaceholder";
import { getSessionProfile } from "@/features/auth/queries";

// Admin dashboard landing (Task 0.7). Admins are not self-registerable; this is
// the login redirect target for admin accounts. Full admin panels arrive later.
export default async function AdminDashboardPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const profile = await getSessionProfile();
  if (!profile) redirect(`/${params.locale}/login`);

  return <DashboardPlaceholder profile={profile} />;
}
