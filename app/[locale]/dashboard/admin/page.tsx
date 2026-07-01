import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { AttributeManager } from "@/components/catalog/AttributeManager";
import { DashboardPlaceholder } from "@/features/auth/components/DashboardPlaceholder";
import { getSessionProfile } from "@/features/auth/queries";
import { getAttributes } from "@/features/catalog/queries";

// Admin dashboard landing (Task 0.7). Admins are not self-registerable; this is
// the login redirect target for admin accounts. CR-01 §G adds the attribute-vocabulary
// manager (color/size facets); further admin panels arrive later.
export default async function AdminDashboardPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const profile = await getSessionProfile();
  if (!profile) redirect(`/${params.locale}/login`);

  const attributes = profile.role === "admin" ? await getAttributes() : [];

  return (
    <DashboardPlaceholder profile={profile}>
      {profile.role === "admin" ? <AttributeManager initialAttributes={attributes} /> : null}
    </DashboardPlaceholder>
  );
}
