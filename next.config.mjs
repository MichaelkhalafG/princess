import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Real product images live in Supabase Storage (`**.supabase.co`). In development
// only, also allow picsum.photos (+ its CDN) so the dummy seed's placeholder images
// render via next/image — an unconfigured host makes <Image> throw at render and
// blanks the grid. Never allowlisted in production (dummy data is dev-only).
const imageRemotePatterns = [{ protocol: "https", hostname: "**.supabase.co" }];
if (process.env.NODE_ENV !== "production") {
  imageRemotePatterns.push(
    { protocol: "https", hostname: "picsum.photos" },
    { protocol: "https", hostname: "fastly.picsum.photos" },
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: imageRemotePatterns,
  },
};

export default withNextIntl(nextConfig);
