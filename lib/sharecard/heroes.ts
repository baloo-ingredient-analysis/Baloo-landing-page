// Share-card hero DB helpers (queries + setters). The generation job (scripts/generate-heroes.ts)
// uses these to find rows that need a hero and to store the result; the card renderer reads hero_url
// directly off the product / list. All helpers take the Db instance explicitly (same convention as
// lib/db/queries/*). Nothing here calls an image API — generation is an offline job, the app only
// reads the cached hero.

import { and, asc, desc, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type { Db } from "../db";
import { listItems, lists, products } from "../db/schema";
import { pickHeroProducts, type HeroProductRef } from "./prompt";

/** Products that have a packshot but no generated hero yet (and are analysed). The generation job's
 *  per-product queue; each becomes a single-product hero reused anywhere that product appears. */
export async function productsNeedingHero(
  dbi: Db,
  limit = 50,
): Promise<{ id: string; name: string; brand: string | null; packshotUrl: string }[]> {
  const rows = await dbi
    .select({ id: products.id, name: products.name, brand: products.brand, packshotUrl: products.imageUrl })
    .from(products)
    .where(and(isNotNull(products.imageUrl), isNull(products.heroUrl), eq(products.analysisStatus, "done")))
    .orderBy(desc(products.createdAt))
    .limit(limit);
  // imageUrl is non-null by the filter above; narrow the type for callers.
  return rows.map((r) => ({ ...r, packshotUrl: r.packshotUrl as string }));
}

export async function setProductHero(dbi: Db, productId: string, heroUrl: string): Promise<void> {
  await dbi
    .update(products)
    .set({ heroUrl, heroGeneratedAt: sql`now()` })
    .where(eq(products.id, productId));
}

// Minutes a failed/in-flight generation "holds" the row before another attempt is allowed — stops a
// burst of fetches (e.g. a crawler, or a poll loop) from each spending a render on the same item.
const HERO_CLAIM_COOLDOWN = sql`now() - interval '5 minutes'`;

/** Atomically claim a product for hero generation. Returns true only to the caller that wins the claim
 *  (no hero yet, and no attempt in the last 5 min); everyone else gets false and must not generate. */
export async function claimProductHero(dbi: Db, productId: string): Promise<boolean> {
  const rows = await dbi
    .update(products)
    .set({ heroGeneratedAt: sql`now()` })
    .where(
      and(
        eq(products.id, productId),
        isNull(products.heroUrl),
        or(isNull(products.heroGeneratedAt), lt(products.heroGeneratedAt, HERO_CLAIM_COOLDOWN)),
      ),
    )
    .returning({ id: products.id });
  return rows.length > 0;
}

/** Atomically claim a list for hero generation (see claimProductHero). */
export async function claimListHero(dbi: Db, listId: string): Promise<boolean> {
  const rows = await dbi
    .update(lists)
    .set({ heroGeneratedAt: sql`now()` })
    .where(
      and(
        eq(lists.id, listId),
        isNull(lists.heroUrl),
        or(isNull(lists.heroGeneratedAt), lt(lists.heroGeneratedAt, HERO_CLAIM_COOLDOWN)),
      ),
    )
    .returning({ id: lists.id });
  return rows.length > 0;
}

/** A public list that needs a hero, with its top products that have packshots (label order), ready to
 *  compose into one scene. Lists with no imaged products are skipped — nothing to render from. */
export type ListHeroCandidate = {
  listId: string;
  slug: string;
  title: string;
  products: HeroProductRef[];
};

export async function listsNeedingHero(dbi: Db, limit = 50, maxProductsPerList = 4): Promise<ListHeroCandidate[]> {
  const candidateLists = await dbi
    .select({ id: lists.id, slug: lists.slug, title: lists.title })
    .from(lists)
    .where(and(eq(lists.isPublic, true), isNull(lists.heroUrl)))
    .orderBy(desc(lists.updatedAt))
    .limit(limit);

  const out: ListHeroCandidate[] = [];
  for (const l of candidateLists) {
    const rawItems = await dbi
      .select({ name: products.name, brand: products.brand, packshotUrl: products.imageUrl })
      .from(listItems)
      .innerJoin(products, eq(products.id, listItems.productId))
      .where(and(eq(listItems.listId, l.id), isNotNull(products.imageUrl)))
      .orderBy(asc(listItems.position))
      .limit(12);
    if (rawItems.length === 0) continue; // nothing imaged to render from yet
    const items = pickHeroProducts(rawItems, maxProductsPerList); // distinct brands for a varied scene
    out.push({
      listId: l.id,
      slug: l.slug,
      title: l.title,
      products: items.map((i) => ({ name: i.name, brand: i.brand, packshotUrl: i.packshotUrl as string })),
    });
  }
  return out;
}

export async function setListHero(dbi: Db, listId: string, heroUrl: string): Promise<void> {
  await dbi
    .update(lists)
    .set({ heroUrl, heroGeneratedAt: sql`now()` })
    .where(eq(lists.id, listId));
}
