import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { getSessionProfile } from "@/features/auth/queries";
import { UploadTestHarness } from "./UploadTestHarness";

/**
 * ⚠️ THROWAWAY dev-only harness to verify `ImageUploader` against the `products`
 * bucket BEFORE the real ProductForm (Task 1.7) exists. **Delete this entire
 * `app/[locale]/dev/` folder before Phase 1 closes.** Not linked in nav; 404s in
 * production; behind an auth check (uploads need a session for Storage RLS).
 * Copy here is hardcoded English by design — throwaway, not shipped (exempt from i18n).
 */
export default async function UploadTestPage({ params }: { params: { locale: string } }) {
  if (process.env.NODE_ENV === "production") notFound();
  setRequestLocale(params.locale);

  const profile = await getSessionProfile();
  if (!profile) redirect(`/${params.locale}/login`);

  return (
    <main className="container flex min-h-screen flex-col gap-6 py-16">
      <div className="flex flex-col gap-1">
        <p className="text-caption font-semibold uppercase tracking-wide text-destructive">
          Dev only — delete before Phase 1 closes
        </p>
        <h1 className="font-serif text-h2 text-foreground">ImageUploader · products bucket</h1>
        <p className="text-body-sm text-muted-foreground">
          Signed in as {profile.email}. Uploads land under{" "}
          <code className="rounded bg-muted px-1">products/&lt;your-uid&gt;/…</code> (Storage RLS).
        </p>
      </div>
      <UploadTestHarness />
    </main>
  );
}
