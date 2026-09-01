// List queries (Order G1) — lists are the primary object of Phase 3. G4 (list pages/editor)
// consumes these; callers own the db() null-guard and, from G2 onward, the auth check that the
// acting user owns the list.

import { and, asc, desc, eq, inArray, max, notInArray, sql } from "drizzle-orm";
import type { Db } from "../index";
import {
  listItems,
  lists,
  offers,
  profiles,
  saves,
  votes,
  products,
  type List,
  type ListItem,
  type Product,
} from "../schema";
import {
  computeAvailability,
  availabilityLabel,
  weightedAvailability,
  blendGeoRank,
  type AvailabilityTone,
  type ListAvailability,
} from "../../region";
import type { Region } from "../../retailers";
import { GEO_WEIGHTS } from "../../config";
import { embedText, embeddingsEnabled, listEmbeddingText } from "../../embeddings";

// Best-effort semantic embedding for a public list (L3). Optional-infra: a no-op without OPENAI_API_KEY,
// and any failure is swallowed — embedding a list must NEVER break creating or editing it. Awaited so a
// freshly created/edited list is searchable right away (list writes are infrequent, not a hot path).
async function embedListRow(
  dbi: Db,
  listId: string,
  title: string,
  description: string | null,
): Promise<void> {
  if (!embeddingsEnabled()) return;
  try {
    const e = await embedText(listEmbeddingText({ title, description }));
    if (e) await dbi.update(lists).set({ embedding: e }).where(eq(lists.id, listId));
  } catch {
    /* swallow — best-effort */
  }
}

export async function createList(
  dbi: Db,
  values: { ownerId: string; title: string; slug: string; description?: string; isPublic?: boolean; coverUrl?: string },
): Promise<List> {
  const [row] = await dbi
    .insert(lists)
    .values({
      ownerId: values.ownerId,
      title: values.title,
      slug: values.slug,
      description: values.description ?? null,
      isPublic: values.isPublic ?? false,
      coverUrl: values.coverUrl ?? null,
    })
    .returning();
  await embedListRow(dbi, row.id, row.title, row.description);
  return row;
}

export async function updateList(
  dbi: Db,
  listId: string,
  patch: Partial<Pick<List, "title" | "description" | "isPublic" | "coverUrl">>,
): Promise<List | null> {
  const [row] = await dbi
    .update(lists)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(eq(lists.id, listId))
    .returning();
  // Re-embed only when the words we embed actually changed.
  if (row && (patch.title !== undefined || patch.description !== undefined)) {
    await embedListRow(dbi, row.id, row.title, row.description);
  }
  return row ?? null;
}

export async function deleteList(dbi: Db, listId: string): Promise<void> {
  await dbi.delete(lists).where(eq(lists.id, listId));
}

// Appends at the end (position = max + 1). The (list_id, product_id) unique index makes adding
// the same product twice a no-op conflict rather than a duplicate row.
export async function addListItem(
  dbi: Db,
  listId: string,
  productId: string,
  note?: string,
): Promise<ListItem | null> {
  const [{ maxPos }] = await dbi
    .select({ maxPos: max(listItems.position) })
    .from(listItems)
    .where(eq(listItems.listId, listId));
  const [row] = await dbi
    .insert(listItems)
    .values({ listId, productId, note: note ?? null, position: (maxPos ?? 0) + 1 })
    .onConflictDoNothing()
    .returning();
  await touch(dbi, listId);
  return row ?? null;
}

// Current item count for a list — used by the S4 per-list hard cap before an add.
export async function countListItems(dbi: Db, listId: string): Promise<number> {
  const [{ n }] = await dbi
    .select({ n: sql<number>`count(*)::int` })
    .from(listItems)
    .where(eq(listItems.listId, listId));
  return n ?? 0;
}

export async function removeListItem(dbi: Db, listId: string, productId: string): Promise<void> {
  await dbi
    .delete(listItems)
    .where(and(eq(listItems.listId, listId), eq(listItems.productId, productId)));
  await touch(dbi, listId);
}

export async function setListItemNote(
  dbi: Db,
  listId: string,
  productId: string,
  note: string | null,
): Promise<void> {
  await dbi
    .update(listItems)
    .set({ note })
    .where(and(eq(listItems.listId, listId), eq(listItems.productId, productId)));
  await touch(dbi, listId);
}

// Full reorder: caller sends the product ids in the desired order; positions are rewritten
// 1..n in one transaction so a dropped request can't leave a half-ordered list.
export async function reorderListItems(
  dbi: Db,
  listId: string,
  orderedProductIds: string[],
): Promise<void> {
  await dbi.transaction(async (tx) => {
    for (let i = 0; i < orderedProductIds.length; i++) {
      await tx
        .update(listItems)
        .set({ position: i + 1 })
        .where(and(eq(listItems.listId, listId), eq(listItems.productId, orderedProductIds[i])));
    }
  });
  await touch(dbi, listId);
}

export type ListWithItems = List & { items: (ListItem & { product: Product })[] };

export async function getListBySlug(dbi: Db, slug: string): Promise<ListWithItems | null> {
  const [list] = await dbi.select().from(lists).where(eq(lists.slug, slug)).limit(1);
  if (!list) return null;

  const rows = await dbi
    .select({ item: listItems, product: products })
    .from(listItems)
    .innerJoin(products, eq(listItems.productId, products.id))
    .where(eq(listItems.listId, list.id))
    .orderBy(asc(listItems.position));

  return { ...list, items: rows.map((r) => ({ ...r.item, product: r.product })) };
}

export async function getListsByOwner(dbi: Db, ownerId: string): Promise<List[]> {
  return dbi.select().from(lists).where(eq(lists.ownerId, ownerId)).orderBy(desc(lists.updatedAt));
}

export async function getListById(dbi: Db, id: string): Promise<List | null> {
  const [row] = await dbi.select().from(lists).where(eq(lists.id, id)).limit(1);
  return row ?? null;
}

// Two list signals since L8: likeCount is PUBLIC (shown on cards, ranks Popular/Explore); saveCount
// is INTERNAL (never shown publicly — feeds ranking only, and the owner's own "Saved" library).
export type ListWithCounts = List & { itemCount: number; saveCount: number; likeCount: number };

// leftJoin + groupBy aggregate (one round-trip). count(distinct …) so the two joins don't
// multiply each other; ::int because count() is a bigint (returned as a string otherwise).
const itemCountExpr = sql<number>`count(distinct ${listItems.id})::int`;
const saveCountExpr = sql<number>`count(distinct ${saves.userId})::int`;
// Likes live in the polymorphic votes table (targetType 'list'). A correlated subquery so it never
// participates in the joins/groupBy above — drop it into any list select unchanged.
const likeCountExpr = sql<number>`(select count(*)::int from ${votes} v where v.target_type = 'list' and v.target_id = ${lists.id})`;

export async function getListsByOwnerWithCounts(dbi: Db, ownerId: string): Promise<ListWithCounts[]> {
  const rows = await dbi
    .select({ list: lists, itemCount: itemCountExpr, saveCount: saveCountExpr, likeCount: likeCountExpr })
    .from(lists)
    .leftJoin(listItems, eq(listItems.listId, lists.id))
    .leftJoin(saves, eq(saves.listId, lists.id))
    .where(eq(lists.ownerId, ownerId))
    .groupBy(lists.id)
    .orderBy(desc(lists.updatedAt));
  return rows.map((r) => ({ ...r.list, itemCount: r.itemCount, saveCount: r.saveCount, likeCount: r.likeCount }));
}

// The profile page's read: PUBLIC lists only — private lists never appear on a profile, the
// owner's own included (owners manage everything via /lists).
export async function getPublicListsByOwnerWithCounts(
  dbi: Db,
  ownerId: string,
): Promise<ListWithCounts[]> {
  const rows = await dbi
    .select({ list: lists, itemCount: itemCountExpr, saveCount: saveCountExpr, likeCount: likeCountExpr })
    .from(lists)
    .leftJoin(listItems, eq(listItems.listId, lists.id))
    .leftJoin(saves, eq(saves.listId, lists.id))
    .where(and(eq(lists.ownerId, ownerId), eq(lists.isPublic, true)))
    .groupBy(lists.id)
    .orderBy(desc(lists.updatedAt));
  return rows.map((r) => ({ ...r.list, itemCount: r.itemCount, saveCount: r.saveCount, likeCount: r.likeCount }));
}

export type ListWithCountsAndOwner = ListWithCounts & { ownerHandle: string | null };

// "Popular this week" (Order G7; ranks by LIKES since L8): public lists ranked by Likes created
// in the last 7 days — Like is the PUBLIC signal (saves are private), so it's the honest ranking
// signal. Recency tie-break. Returns [] when there's no signal — the section hides rather than
// faking a ranking.
export async function getPopularListsThisWeek(
  dbi: Db,
  limit = 8,
): Promise<(ListWithCountsAndOwner & { signal: number })[]> {
  const weekAgo = sql`now() - interval '7 days'`;
  const signalExpr = sql<number>`(
    (select count(*)::int from ${votes} v where v.target_type = 'list' and v.target_id = ${lists.id} and v.created_at > ${weekAgo})
  )`;
  const rows = await dbi
    .select({
      list: lists,
      itemCount: sql<number>`(select count(*)::int from ${listItems} li where li.list_id = ${lists.id})`,
      saveCount: sql<number>`(select count(*)::int from ${saves} s3 where s3.list_id = ${lists.id})`,
      likeCount: likeCountExpr,
      ownerHandle: profiles.handle,
      signal: signalExpr,
    })
    .from(lists)
    .innerJoin(profiles, eq(profiles.id, lists.ownerId))
    .where(eq(lists.isPublic, true))
    .orderBy(sql`${signalExpr} desc`, desc(lists.updatedAt))
    .limit(limit);
  return rows
    .filter((r) => r.signal > 0)
    .map((r) => ({
      ...r.list,
      itemCount: r.itemCount,
      saveCount: r.saveCount,
      likeCount: r.likeCount,
      ownerHandle: r.ownerHandle,
      signal: r.signal,
    }));
}

// Public discovery feed (Order G5 expands the G4 stub with the owner handle for cards).
export async function getPublicListsRecent(dbi: Db, limit = 12): Promise<ListWithCountsAndOwner[]> {
  const rows = await dbi
    .select({
      list: lists,
      itemCount: itemCountExpr,
      saveCount: saveCountExpr,
      likeCount: likeCountExpr,
      ownerHandle: profiles.handle,
    })
    .from(lists)
    .leftJoin(listItems, eq(listItems.listId, lists.id))
    .leftJoin(saves, eq(saves.listId, lists.id))
    .innerJoin(profiles, eq(profiles.id, lists.ownerId))
    .where(eq(lists.isPublic, true))
    .groupBy(lists.id, profiles.handle)
    .orderBy(desc(lists.updatedAt))
    .limit(limit);
  return rows.map((r) => ({
    ...r.list,
    itemCount: r.itemCount,
    saveCount: r.saveCount,
    likeCount: r.likeCount,
    ownerHandle: r.ownerHandle,
  }));
}

// Explore (Order L9) — the Discover surface: public lists ranked by a blended engagement + recency
// score. Likes are public, saves are the internal signal; both feed the score, then a gentle recency
// decay keeps fresh lists visible. When a viewer is known we EXCLUDE what already lives in their
// Following surface (/feed): their own lists and anyone they follow. Signed-out ranks everyone.
// Region soft-rank (L7) is applied by the caller via withRegionAvailability. No "search/category
// relevance" yet — no taxonomy exists; the SearchBox stays the finder until H1.
export async function getExploreLists(
  dbi: Db,
  opts: { limit?: number; excludeOwnerIds?: string[] } = {},
): Promise<ListWithCountsAndOwner[]> {
  const { limit = 24, excludeOwnerIds = [] } = opts;
  // likes + saves as engagement, minus a small penalty per day since last touch (recency decay).
  const scoreExpr = sql<number>`(
    (select count(*)::int from ${votes} v where v.target_type = 'list' and v.target_id = ${lists.id})
    + (select count(*)::int from ${saves} s where s.list_id = ${lists.id})
    - (extract(epoch from (now() - ${lists.updatedAt})) / 86400.0) * 0.5
  )`;
  const where =
    excludeOwnerIds.length > 0
      ? and(eq(lists.isPublic, true), notInArray(lists.ownerId, excludeOwnerIds))
      : eq(lists.isPublic, true);
  const rows = await dbi
    .select({
      list: lists,
      itemCount: sql<number>`(select count(*)::int from ${listItems} li where li.list_id = ${lists.id})`,
      saveCount: sql<number>`(select count(*)::int from ${saves} s2 where s2.list_id = ${lists.id})`,
      likeCount: likeCountExpr,
      ownerHandle: profiles.handle,
    })
    .from(lists)
    .innerJoin(profiles, eq(profiles.id, lists.ownerId))
    .where(where)
    .orderBy(sql`${scoreExpr} desc`, desc(lists.updatedAt))
    .limit(limit);
  return rows.map((r) => ({
    ...r.list,
    itemCount: r.itemCount,
    saveCount: r.saveCount,
    likeCount: r.likeCount,
    ownerHandle: r.ownerHandle,
  }));
}

// ── Region availability (Order L7) ────────────────────────────────────────────────────────────
export type ListRegionInfo = ListAvailability & { label: string; tone: AvailabilityTone };

// Per list → per product → the set of retailers it's sold at (base products.retailer ∪ all
// offers.retailer). ONE query for the whole batch; aggregated in code so the retailer→region map
// stays in lib/. Empty ids → empty map.
export async function getListsRetailers(
  dbi: Db,
  listIds: string[],
): Promise<Map<string, Map<string, string[]>>> {
  const out = new Map<string, Map<string, string[]>>();
  if (listIds.length === 0) return out;
  const rows = await dbi
    .select({
      listId: listItems.listId,
      productId: listItems.productId,
      productRetailer: products.retailer,
      offerRetailer: offers.retailer,
    })
    .from(listItems)
    .innerJoin(products, eq(products.id, listItems.productId))
    .leftJoin(offers, eq(offers.productId, listItems.productId))
    .where(inArray(listItems.listId, listIds));

  for (const r of rows) {
    let perProduct = out.get(r.listId);
    if (!perProduct) out.set(r.listId, (perProduct = new Map()));
    let set = perProduct.get(r.productId);
    if (!set) perProduct.set(r.productId, (set = []));
    for (const rt of [r.productRetailer, r.offerRetailer]) {
      if (rt && !set.includes(rt)) set.push(rt);
    }
  }
  return out;
}

// Annotate already-fetched lists with their availability badge in `region`, then BLEND geo into the
// ranking (Order GR3). The incoming order is the base ranking (engagement + recency); geo enters as
// `base × (1 + λ_feed · geo)` via `blendGeoRank`, so a locally-buyable list is nudged up but a very
// popular non-local one keeps its place — interest drives ranking, geo never hard-filters (a list is
// NEVER dropped). `region` doubles as the ranking country (the `UK→GB` shim in retailerServes folds
// it). The neutral `availability` badge still comes from L7's binary `computeAvailability`.
// Additive layer over getExploreLists / getPublicListsRecent / getPopularListsThisWeek.
export async function withRegionAvailability<T extends { id: string }>(
  dbi: Db,
  rows: T[],
  region: Region,
): Promise<(T & { availability: ListRegionInfo | null })[]> {
  if (rows.length === 0) return [];
  const retailers = await getListsRetailers(dbi, rows.map((r) => r.id));
  const annotated = rows.map((row) => {
    const perProduct = retailers.get(row.id) ?? new Map<string, string[]>();
    const a = computeAvailability(perProduct, region);
    const label = availabilityLabel(a);
    const geo = weightedAvailability(perProduct, region);
    return { ...row, availability: label ? { ...a, ...label } : null, _geo: geo };
  });
  return blendGeoRank(annotated, (r) => r._geo, GEO_WEIGHTS.lambdaFeed).map(
    ({ _geo, ...row }) => row as T & { availability: ListRegionInfo | null },
  );
}

async function touch(dbi: Db, listId: string): Promise<void> {
  await dbi.update(lists).set({ updatedAt: sql`now()` }).where(eq(lists.id, listId));
}
