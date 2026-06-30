/**
 * Dev-only catalog seed (NOT shipped; NOT a migration). Populates the dev database
 * with realistic dummy categories + products + variants so the catalog UI and the
 * Phase-1 e2e (public browse/filter/detail + seller manager) have data to find.
 *
 * Uses the LIVE schema (DATABASE.md / lib/database.types.ts) via the service-role
 * client (bypasses RLS — server/CLI only). Deterministic (seeded PRNG) so reruns
 * produce the same shape; idempotent (re-seeding replaces the dummy sellers'
 * products rather than piling up duplicates). It ONLY ever creates/touches the
 * dummy sellers it owns (`@seed.princess.test`) and their products — never real
 * users or real products.
 *
 *   pnpm seed:dummy    # ensure dummy sellers + categories, (re)seed their products
 *   pnpm seed:reset    # wipe the dummy sellers (cascades their products) + reseed
 *
 * GUARD: refuses to run unless `SEED_DUMMY=1` is set (add it to `.env.local`), and
 * refuses when NODE_ENV=production or on Vercel — so it can never hit prod.
 * The sandbox can't reach Postgres; run it from your own terminal.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database, Enums, Json, TablesInsert } from "@/lib/database.types";

type Currency = Enums<"currency_code">;
type ListingStatus = Enums<"listing_status">;
type CategoryInsert = TablesInsert<"categories">;
type ProductInsert = TablesInsert<"products">;
type VariantInsert = TablesInsert<"product_variants">;

interface SeedImage {
  url: string;
  alt: string;
  sort: number;
}

// ---------------------------------------------------------------------------
// .env.local loader (no dependency) — mirrors scripts/tap-spike.ts.
// ---------------------------------------------------------------------------
function loadEnvLocal(): void {
  let content: string;
  try {
    content = readFileSync(".env.local", "utf8");
  } catch {
    return;
  }
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function maskUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(invalid url)";
  }
}

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) — stable dummy data across runs.
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20260630);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)] as T;
const randInt = (min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));
const round2 = (n: number): number => Math.round(n * 100) / 100;
const chance = (p: number): boolean => rng() < p;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Data pools.
// ---------------------------------------------------------------------------
type VariantKind = "apparel" | "shoes" | "color" | "none";

interface ProductCategoryConfig {
  slug: string;
  name_ar: string;
  name_en: string;
  priceMin: number;
  priceMax: number;
  rentable: boolean;
  variant: VariantKind;
  ar: readonly string[];
  en: readonly string[];
}

const PRODUCT_CATEGORIES: readonly ProductCategoryConfig[] = [
  {
    slug: "dresses",
    name_ar: "فساتين",
    name_en: "Dresses",
    priceMin: 150,
    priceMax: 1200,
    rentable: true,
    variant: "apparel",
    ar: ["فستان سهرة", "فستان كاجوال", "فستان صيفي", "فستان مطرّز", "فستان حرير"],
    en: ["Evening Dress", "Casual Dress", "Summer Dress", "Embroidered Gown", "Silk Dress"],
  },
  {
    slug: "abayas",
    name_ar: "عبايات",
    name_en: "Abayas",
    priceMin: 200,
    priceMax: 1500,
    rentable: true,
    variant: "apparel",
    ar: ["عباية كلوش", "عباية مطرّزة", "عباية ناعمة", "عباية كم واسع", "عباية يومية"],
    en: ["Flared Abaya", "Embroidered Abaya", "Soft Abaya", "Wide-Sleeve Abaya", "Everyday Abaya"],
  },
  {
    slug: "makeup",
    name_ar: "مكياج",
    name_en: "Makeup",
    priceMin: 30,
    priceMax: 400,
    rentable: false,
    variant: "none",
    ar: ["أحمر شفاه", "باليت ظلال", "كريم أساس", "ماسكارا", "محدّد عيون"],
    en: ["Lipstick", "Eyeshadow Palette", "Foundation", "Mascara", "Eyeliner"],
  },
  {
    slug: "skincare",
    name_ar: "العناية بالبشرة",
    name_en: "Skincare",
    priceMin: 40,
    priceMax: 500,
    rentable: false,
    variant: "none",
    ar: ["سيروم فيتامين سي", "مرطّب يومي", "غسول لطيف", "واقٍ من الشمس", "كريم ليلي"],
    en: ["Vitamin C Serum", "Daily Moisturizer", "Gentle Cleanser", "Sunscreen", "Night Cream"],
  },
  {
    slug: "fragrances",
    name_ar: "عطور",
    name_en: "Fragrances",
    priceMin: 100,
    priceMax: 900,
    rentable: false,
    variant: "none",
    ar: ["عطر وردي", "عطر مسك", "عطر عود", "عطر زهري", "عطر منعش"],
    en: ["Rose Perfume", "Musk Perfume", "Oud Perfume", "Floral Perfume", "Fresh Perfume"],
  },
  {
    slug: "accessories",
    name_ar: "إكسسوارات",
    name_en: "Accessories",
    priceMin: 25,
    priceMax: 600,
    rentable: false,
    variant: "color",
    ar: ["قلادة ذهبية", "أقراط لؤلؤ", "إسوارة أنيقة", "خاتم مرصّع", "دبوس شعر"],
    en: ["Gold Necklace", "Pearl Earrings", "Elegant Bracelet", "Studded Ring", "Hair Pin"],
  },
  {
    slug: "bridal",
    name_ar: "فساتين زفاف",
    name_en: "Bridal",
    priceMin: 800,
    priceMax: 6000,
    rentable: true,
    variant: "apparel",
    ar: ["فستان زفاف دانتيل", "فستان زفاف ملكي", "فستان زفاف بسيط", "فستان زفاف مطرّز", "فستان خطوبة"],
    en: ["Lace Wedding Gown", "Royal Bridal Gown", "Minimal Wedding Dress", "Embroidered Bridal Gown", "Engagement Gown"],
  },
  {
    slug: "bags",
    name_ar: "حقائب",
    name_en: "Bags",
    priceMin: 120,
    priceMax: 2500,
    rentable: false,
    variant: "color",
    ar: ["حقيبة يد جلد", "حقيبة كتف", "حقيبة سهرة", "حقيبة ظهر أنيقة", "كلتش مطرّز"],
    en: ["Leather Handbag", "Shoulder Bag", "Evening Clutch", "Elegant Backpack", "Embroidered Clutch"],
  },
  {
    slug: "shoes",
    name_ar: "أحذية",
    name_en: "Shoes",
    priceMin: 90,
    priceMax: 1200,
    rentable: false,
    variant: "shoes",
    ar: ["حذاء كعب عالٍ", "حذاء مسطّح", "صندل أنيق", "حذاء رياضي", "بوت كاحل"],
    en: ["High Heels", "Flat Shoes", "Elegant Sandals", "Sneakers", "Ankle Boots"],
  },
] as const;

const SERVICE_CATEGORIES: readonly Pick<CategoryInsert, "slug" | "name_ar" | "name_en">[] = [
  { slug: "makeup-artistry", name_ar: "خدمات مكياج", name_en: "Makeup Artistry" },
  { slug: "hair-styling", name_ar: "تصفيف الشعر", name_en: "Hair Styling" },
] as const;

const ADJ_AR = ["الفاخرة", "الأنيقة", "الملكية", "الحريرية", "العصرية", "الناعمة", "الراقية"] as const;
const ADJ_EN = ["Luxe", "Elegant", "Royal", "Couture", "Modern", "Soft", "Premium"] as const;
const COLORS_AR = ["أسود", "أبيض", "وردي", "ذهبي", "كحلي", "بيج", "أحمر", "أخضر زمردي"] as const;
const SIZES_APPAREL = ["XS", "S", "M", "L", "XL"] as const;
const SIZES_SHOES = ["37", "38", "39", "40", "41", "42"] as const;

const PER_CATEGORY = 12; // 9 product categories → ~108 products

// Dummy sellers this script owns. The `@seed.princess.test` domain is the cleanup
// key and keeps these distinct from e2e (`@e2e.…`) and rls (`@rls-test.…`) users.
const SEED_SELLER_DOMAIN = "@seed.princess.test";
const SEED_SELLER_PASSWORD = "Princess12345";
const SEED_SELLERS: readonly { email: string; name: string }[] = [
  { email: `seed-seller-1${SEED_SELLER_DOMAIN}`, name: "أزياء الأميرة" },
  { email: `seed-seller-2${SEED_SELLER_DOMAIN}`, name: "بيت الجمال" },
  { email: `seed-seller-3${SEED_SELLER_DOMAIN}`, name: "لمسة أناقة" },
] as const;

interface SeededSeller {
  id: string;
  email: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Builders.
// ---------------------------------------------------------------------------
function buildCategoryRows(): CategoryInsert[] {
  let sort = 0;
  const products: CategoryInsert[] = PRODUCT_CATEGORIES.map((c) => ({
    kind: "product",
    name_ar: c.name_ar,
    name_en: c.name_en,
    slug: c.slug,
    sort_order: sort++,
  }));
  const services: CategoryInsert[] = SERVICE_CATEGORIES.map((c) => ({
    kind: "service",
    name_ar: c.name_ar,
    name_en: c.name_en,
    slug: c.slug,
    sort_order: sort++,
  }));
  return [...products, ...services];
}

function buildImages(seedKey: string, titleAr: string): SeedImage[] {
  const count = randInt(3, 6);
  return Array.from({ length: count }, (_, i) => ({
    url: `https://picsum.photos/seed/${seedKey}-${i}/800/1000`,
    alt: `${titleAr} — صورة ${i + 1}`,
    sort: i,
  }));
}

function buildVariants(productId: string, seedKey: string, kind: VariantKind): VariantInsert[] {
  if (kind === "none" || !chance(0.6)) return [];

  const sizes: readonly string[] =
    kind === "apparel" ? SIZES_APPAREL : kind === "shoes" ? SIZES_SHOES : [""];

  // Build all (size,color) pairs, deterministically shuffle, take the first N —
  // guarantees the unique (product_id, size, color) constraint holds.
  const pairs: { size: string | null; color: string }[] = [];
  for (const size of sizes) {
    for (const color of COLORS_AR) pairs.push({ size: size === "" ? null : size, color });
  }
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j] as (typeof pairs)[number], pairs[i] as (typeof pairs)[number]];
  }

  const n = Math.min(randInt(1, 4), pairs.length);
  return pairs.slice(0, n).map((pair, idx) => ({
    product_id: productId,
    size: pair.size,
    color: pair.color,
    stock: randInt(0, 30),
    sku: `SKU-${seedKey}-${idx + 1}`.toUpperCase(),
  }));
}

interface BuiltCatalog {
  products: ProductInsert[];
  variants: VariantInsert[];
}

function buildCatalog(sellers: readonly SeededSeller[], categoryIdBySlug: Map<string, string>): BuiltCatalog {
  const products: ProductInsert[] = [];
  const variants: VariantInsert[] = [];
  let n = 0;

  for (const cfg of PRODUCT_CATEGORIES) {
    const categoryId = categoryIdBySlug.get(cfg.slug);
    if (!categoryId) continue; // category upsert should always provide it

    for (let i = 0; i < PER_CATEGORY; i++) {
      const id = randomUUID();
      const seedKey = `princess-${cfg.slug}-${i}`;
      const useArabic = chance(0.6);
      const baseIndex = i % cfg.ar.length;
      const titleAr = `${cfg.ar[baseIndex]} ${pick(ADJ_AR)}`;
      const titleEn = `${cfg.en[baseIndex]} ${pick(ADJ_EN)}`;
      const title = useArabic ? titleAr : titleEn;

      const price = round2(cfg.priceMin + rng() * (cfg.priceMax - cfg.priceMin));
      const currency: Currency = n % 3 === 0 ? "EGP" : "SAR";

      // MOSTLY active so the public-browse + detail e2e find listings.
      const r = rng();
      const status: ListingStatus = r < 0.8 ? "active" : r < 0.9 ? "draft" : "inactive";

      const isRentable = cfg.rentable && chance(0.4);
      const images = buildImages(seedKey, titleAr);
      const seller = sellers[n % sellers.length] as SeededSeller;

      products.push({
        id,
        seller_id: seller.id,
        category_id: categoryId,
        title,
        description: `${titleAr} — خامات فاخرة وجودة عالية. ${titleEn} — premium materials and a refined finish.`,
        price,
        currency,
        is_rentable: isRentable,
        rental_daily_price: isRentable ? round2(price * 0.08) : null,
        security_deposit: isRentable ? round2(price * 0.3) : null,
        images: images as unknown as Json,
        stock: randInt(0, 60),
        status,
      });

      variants.push(...buildVariants(id, seedKey, cfg.variant));
      n++;
    }
  }

  return { products, variants };
}

// ---------------------------------------------------------------------------
// DB operations (service-role).
// ---------------------------------------------------------------------------
function adminClient(url: string, serviceRoleKey: string): SupabaseClient<Database> {
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function findSeedSellerIds(db: SupabaseClient<Database>): Promise<Map<string, string>> {
  const { data, error } = await db
    .from("profiles")
    .select("id, email")
    .like("email", `%${SEED_SELLER_DOMAIN}`);
  if (error) throw new Error(`lookup seed sellers failed: ${error.message}`);
  const byEmail = new Map<string, string>();
  for (const row of data ?? []) if (row.email) byEmail.set(row.email, row.id);
  return byEmail;
}

async function ensureSellers(db: SupabaseClient<Database>): Promise<SeededSeller[]> {
  const existing = await findSeedSellerIds(db);
  const sellers: SeededSeller[] = [];

  for (const def of SEED_SELLERS) {
    let id = existing.get(def.email);
    if (!id) {
      const { data, error } = await db.auth.admin.createUser({
        email: def.email,
        password: SEED_SELLER_PASSWORD,
        email_confirm: true,
        user_metadata: { role: "seller", full_name: def.name },
      });
      if (error || !data.user) throw new Error(`create seller ${def.email} failed: ${error?.message}`);
      id = data.user.id;
    }
    // The signup trigger sets seller→pending; promote to active so they can list.
    const { error: promoteError } = await db
      .from("profiles")
      .update({ role: "seller", status: "active", full_name: def.name })
      .eq("id", id);
    if (promoteError) throw new Error(`promote ${def.email} failed: ${promoteError.message}`);
    sellers.push({ id, email: def.email, name: def.name });
  }
  return sellers;
}

async function upsertCategories(db: SupabaseClient<Database>): Promise<Map<string, string>> {
  const rows = buildCategoryRows();
  const { data, error } = await db
    .from("categories")
    .upsert(rows, { onConflict: "slug" })
    .select("id, slug");
  if (error) throw new Error(`upsert categories failed: ${error.message}`);
  const idBySlug = new Map<string, string>();
  for (const row of data ?? []) idBySlug.set(row.slug, row.id);
  return idBySlug;
}

/** Remove ONLY the dummy sellers' products (cascades their variants). */
async function wipeDummyProducts(db: SupabaseClient<Database>, sellerIds: readonly string[]): Promise<void> {
  if (sellerIds.length === 0) return;
  const { error } = await db.from("products").delete().in("seller_id", sellerIds);
  if (error) throw new Error(`wipe dummy products failed: ${error.message}`);
}

/** Delete the dummy sellers' auth users (cascades profiles → products → variants). */
async function deleteDummySellers(db: SupabaseClient<Database>): Promise<number> {
  const existing = await findSeedSellerIds(db);
  for (const id of existing.values()) {
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) throw new Error(`delete seller ${id} failed: ${error.message}`);
  }
  return existing.size;
}

async function insertProducts(db: SupabaseClient<Database>, rows: readonly ProductInsert[]): Promise<void> {
  for (const part of chunk(rows, 100)) {
    const { error } = await db.from("products").insert(part);
    if (error) throw new Error(`insert products failed: ${error.message}`);
  }
}

async function insertVariants(db: SupabaseClient<Database>, rows: readonly VariantInsert[]): Promise<void> {
  for (const part of chunk(rows, 100)) {
    const { error } = await db.from("product_variants").insert(part);
    if (error) throw new Error(`insert product_variants failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const reset = process.argv.includes("--reset");

  // ---- Production guard (dev-only) -------------------------------------------------
  if (process.env.SEED_DUMMY !== "1") {
    console.error(
      "✗ Refusing to seed: set SEED_DUMMY=1 (add it to .env.local) to confirm this is a DEV database.",
    );
    process.exitCode = 1;
    return;
  }
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    console.error("✗ Refusing to seed in a production environment (NODE_ENV=production / Vercel).");
    process.exitCode = 1;
    return;
  }
  if (!url || !serviceRoleKey) {
    console.error("✗ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");
    process.exitCode = 1;
    return;
  }

  console.log(`Princess dummy seed${reset ? " (reset)" : ""}`);
  console.log(`  target: ${maskUrl(url)}`);
  console.log(`  dummy sellers: ${SEED_SELLER_DOMAIN}\n`);

  const db = adminClient(url, serviceRoleKey);

  if (reset) {
    const removed = await deleteDummySellers(db);
    console.log(`✓ reset: removed ${removed} dummy seller(s) + their products/variants\n`);
  }

  const sellers = await ensureSellers(db);
  console.log(`✓ sellers ready: ${sellers.map((s) => s.email).join(", ")}`);

  const categoryIdBySlug = await upsertCategories(db);
  console.log(`✓ categories upserted: ${categoryIdBySlug.size} (incl. ${SERVICE_CATEGORIES.length} service)`);

  // Idempotent: clear this run's-owner products before inserting a fresh set.
  await wipeDummyProducts(db, sellers.map((s) => s.id));

  const { products, variants } = buildCatalog(sellers, categoryIdBySlug);
  await insertProducts(db, products);
  await insertVariants(db, variants);

  const activeCount = products.filter((p) => p.status === "active").length;
  const rentableCount = products.filter((p) => p.is_rentable).length;
  console.log(`✓ products inserted: ${products.length} (${activeCount} active, ${rentableCount} rentable)`);
  console.log(`✓ variants inserted: ${variants.length}`);

  // The catalog reads are cached (unstable_cache, tag `products`/`categories`, D5)
  // and this seed wrote straight to the DB — so bust those tags. Best-effort: only
  // works if a dev server is running; otherwise clear `.next/cache` before serving.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${appUrl}/api/dev/revalidate`, { method: "POST" });
    console.log(
      res.ok
        ? `✓ revalidated catalog cache via ${appUrl}`
        : `… revalidate ping → ${res.status}; if /products looks stale, clear .next/cache and restart`,
    );
  } catch {
    console.log(
      `… no dev server at ${appUrl}; if /products looks stale, clear .next/cache (or call /api/dev/revalidate) then restart`,
    );
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
