// Product queries (Order G1). All helpers take the Db instance explicitly — callers own the
// null-guard (`const dbi = db(); if (!dbi) ...`), keeping "database optional" visible at the
// call site. G3's ingestion and product page consume these.

import { and, desc, eq, ilike, inArray, isNotNull, or } from "drizzle-orm";
import type { Db } from "../index";
import { ingredientKey } from "../../canonical";
import {
  ingredients,
  ingredientProfileItems,
  ingredientProfiles,
  nutrition,
  offers,
  products,
  type AnalysisStatus,
  type IngredientProfileItem,
  type NewProduct,
  type NutritionRow,
  type Product,
} from "../schema";

// THE dedup invariant: everyone ingesting the same real-world product converges on one row.
// Conflict on canonical_key refreshes the descriptive fields (name/brand/image may improve
// between scans) but never changes identity.
export async function upsertProductByCanonicalKey(
  dbi: Db,
  values: NewProduct,
): Promise<Product> {
  const [row] = await dbi
    .insert(products)
    .values(values)
    .onConflictDoUpdate({
      target: products.canonicalKey,
      set: {
        name: values.name,
        brand: values.brand ?? null,
        retailer: values.retailer ?? null,
        barcode: values.barcode ?? null,
        imageUrl: values.imageUrl ?? null,
        countries: values.countries ?? null,
      },
    })
    .returning();
  return row;
}

export async function getProductBySlugOrKey(dbi: Db, slugOrKey: string): Promise<Product | null> {
  const [row] = await dbi
    .select()
    .from(products)
    .where(or(eq(products.slug, slugOrKey), eq(products.canonicalKey, slugOrKey)))
    .limit(1);
  return row ?? null;
}

export async function getProductById(dbi: Db, id: string): Promise<Product | null> {
  const [row] = await dbi.select().from(products).where(eq(products.id, id)).limit(1);
  return row ?? null;
}

// Analysis lifecycle (Order P2). pending → analysing → done | failed.
export async function setAnalysisStatus(
  dbi: Db,
  productId: string,
  status: AnalysisStatus,
): Promise<void> {
  await dbi.update(products).set({ analysisStatus: status }).where(eq(products.id, productId));
}

/**
 * What the background job needs to (re)analyse a product: the product plus the URL to scrape.
 * The URL comes from its offers — which is exactly why P1 put them there. Prefers the most
 * recently recorded offer that actually has a URL (backfilled offers have none).
 */
export async function getProductAnalysisTarget(
  dbi: Db,
  productId: string,
): Promise<{ product: Product; url: string } | null> {
  const product = await getProductById(dbi, productId);
  if (!product) return null;
  const [offer] = await dbi
    .select({ url: offers.url })
    .from(offers)
    .where(and(eq(offers.productId, productId), isNotNull(offers.url)))
    .orderBy(desc(offers.createdAt))
    .limit(1);
  if (!offer?.url) return null;
  return { product, url: offer.url };
}

// The product page's main read: the ACTIVE ingredient profile + its items in label order.
export async function getActiveProfileWithItems(
  dbi: Db,
  productId: string,
): Promise<{ profileId: string; version: number; items: IngredientProfileItem[] } | null> {
  const [profile] = await dbi
    .select()
    .from(ingredientProfiles)
    .where(and(eq(ingredientProfiles.productId, productId), eq(ingredientProfiles.isActive, true)))
    .limit(1);
  if (!profile) return null;

  const items = await dbi
    .select()
    .from(ingredientProfileItems)
    .where(eq(ingredientProfileItems.profileId, profile.id))
    .orderBy(ingredientProfileItems.rank);

  return { profileId: profile.id, version: profile.version, items };
}

// The discover page's "New on Baloo" strip (Order G5).
export async function getRecentProducts(dbi: Db, limit = 8): Promise<Product[]> {
  return dbi.select().from(products).orderBy(desc(products.createdAt)).limit(limit);
}

// Product picker search (Order G4) — powers the editor's "Add via search". Name match, newest
// first. (G5 upgrades this to full-text over brand/name + lists.)
export async function searchProducts(dbi: Db, q: string, limit = 10): Promise<Product[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  return dbi
    .select()
    .from(products)
    .where(ilike(products.name, `%${term}%`))
    .limit(limit);
}

export async function getNutritionForProduct(dbi: Db, productId: string) {
  const [row] = await dbi.select().from(nutrition).where(eq(nutrition.productId, productId)).limit(1);
  return row ?? null;
}

export type ProductPageItem = {
  name: string;
  tag: "Natural" | "Processed" | null;
  role: string | null;
  percent: string | null;
  whyItsHere: string | null;
  percentageNote: string | null;
  whatItIs: string | null; // joined from the shared ingredients cache
};

export type ProductPageData = {
  product: Product;
  version: number;
  summary: string | null;
  items: ProductPageItem[];
  nutrition: NutritionRow | null;
};

// One assembled read for /p/[slug]: product + active profile (version, summary) + items with the
// product-independent what_it_is merged in from the shared `ingredients` cache + nutrition.
// The item→ingredients match is done in code (via ingredientKey) rather than SQL, so the same
// normalisation used on write is used on read.
export async function getProductForPage(dbi: Db, slug: string): Promise<ProductPageData | null> {
  const product = await getProductBySlugOrKey(dbi, slug);
  if (!product) return null;

  const nutritionRow = await getNutritionForProduct(dbi, product.id);

  const [profile] = await dbi
    .select()
    .from(ingredientProfiles)
    .where(and(eq(ingredientProfiles.productId, product.id), eq(ingredientProfiles.isActive, true)))
    .limit(1);
  if (!profile) {
    return { product, version: 0, summary: null, items: [], nutrition: nutritionRow };
  }

  const itemRows = await dbi
    .select()
    .from(ingredientProfileItems)
    .where(eq(ingredientProfileItems.profileId, profile.id))
    .orderBy(ingredientProfileItems.rank);

  const keys = [...new Set(itemRows.map((r) => ingredientKey(r.name)))];
  const defs = keys.length
    ? await dbi
        .select({ canonicalName: ingredients.canonicalName, whatItIs: ingredients.whatItIs })
        .from(ingredients)
        .where(inArray(ingredients.canonicalName, keys))
    : [];
  const whatMap = new Map(defs.map((d) => [d.canonicalName, d.whatItIs]));

  const items: ProductPageItem[] = itemRows.map((r) => ({
    name: r.name,
    tag: r.tag,
    role: r.role,
    percent: r.percent,
    whyItsHere: r.whyItsHere,
    percentageNote: r.percentageNote,
    whatItIs: whatMap.get(ingredientKey(r.name)) ?? null,
  }));

  return { product, version: profile.version, summary: profile.summary, items, nutrition: nutritionRow };
}
