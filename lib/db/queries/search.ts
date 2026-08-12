// Site search (Order G5): products + PUBLIC lists in one call, for /discover and /api/search.
//
// Deliberate deviation from the build guide's "Postgres full-text": at the current catalog size,
// ILIKE substring matching behaves BETTER than stemmed tsquery for partial brand names ("oat" →
// "Oatly"), and it needs no migration. The result shape here is the stable API; when H1's Open
// Food Facts import brings real volume, the internals upgrade to generated tsvector columns +
// GIN indexes without touching any caller.

import { and, desc, eq, ilike, or } from "drizzle-orm";
import type { Db } from "../index";
import { listItems, lists, profiles, products, saves, votes, type Product } from "../schema";
import { sql } from "drizzle-orm";
import { toVectorLiteral } from "../../embeddings";
import { productAvailability, blendGeoRank } from "../../region";
import { GEO_WEIGHTS } from "../../config";
import type { ListWithCountsAndOwner } from "./lists";

export type SearchResults = {
  products: Product[];
  lists: ListWithCountsAndOwner[];
};

// Cosine distance (pgvector <=> ) above this is treated as "not really related" and dropped, so a
// query with no close products doesn't pull in junk. 0 = identical, 2 = opposite; ~0.2–0.5 is a good
// match. Tunable once there's real catalog volume.
const SEMANTIC_MAX_DISTANCE = 0.7;

// Reciprocal-rank fusion: merge several ranked lists into one. An item ranked high in EITHER list
// scores well, so exact keyword hits and semantic hits both surface. k=60 is the standard constant.
// Exported for unit tests (search.test.ts); callers use searchAll.
export function fuseByRank(lists: Product[][], k = 60): Product[] {
  const score = new Map<string, number>();
  const byId = new Map<string, Product>();
  for (const list of lists) {
    list.forEach((p, i) => {
      byId.set(p.id, p);
      score.set(p.id, (score.get(p.id) ?? 0) + 1 / (k + i + 1));
    });
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => byId.get(id)!);
}

/**
 * Site search — products + PUBLIC lists. Products are HYBRID when `queryEmbedding` is provided:
 * keyword (ILIKE) results fused with pgvector semantic results, so "dairy-free milk" finds an oat
 * drink AND "oatly" finds Oatly. Without an embedding (no OPENAI_API_KEY, or the embed failed) it's
 * pure keyword — identical to before. Lists stay keyword-only.
 *
 * When `country` is given (viewer's Vercel geo), product results get a LIGHT geo tiebreak (Order
 * GR4): relevance still decides the page, geo only reorders near-equal hits (`lambdaSearch` ≪
 * `lambdaFeed`), so a strongly-relevant non-local product still ranks first. Lists stay on pure
 * relevance. No-op without a country.
 */
export async function searchAll(
  dbi: Db,
  q: string,
  limitEach = 10,
  queryEmbedding?: number[] | null,
  country?: string | null,
): Promise<SearchResults> {
  const term = q.trim();
  if (term.length < 2) return { products: [], lists: [] };
  const pat = `%${term}%`;
  const candidateN = Math.max(limitEach * 2, 20); // widen the pool before fusion

  const keywordProducts = await dbi
    .select()
    .from(products)
    .where(or(ilike(products.name, pat), ilike(products.brand, pat)))
    .orderBy(desc(products.createdAt))
    .limit(candidateN);

  let semanticProducts: Product[] = [];
  if (queryEmbedding && queryEmbedding.length) {
    const vec = toVectorLiteral(queryEmbedding);
    semanticProducts = await dbi
      .select()
      .from(products)
      .where(
        sql`${products.embedding} is not null and (${products.embedding} <=> ${vec}::vector) < ${SEMANTIC_MAX_DISTANCE}`,
      )
      .orderBy(sql`${products.embedding} <=> ${vec}::vector`)
      .limit(candidateN);
  }

  const relevanceRanked =
    queryEmbedding && queryEmbedding.length
      ? fuseByRank([keywordProducts, semanticProducts]).slice(0, limitEach)
      : keywordProducts.slice(0, limitEach);

  // GR4: light geo tiebreak on the visible page — reorders near-equal relevance, never overrides it.
  const productRows = country
    ? blendGeoRank(
        relevanceRanked,
        (p) => productAvailability(p.retailer ? [p.retailer] : [], country),
        GEO_WEIGHTS.lambdaSearch,
      )
    : relevanceRanked;

  const listRows = await dbi
    .select({
      list: lists,
      itemCount: sql<number>`count(distinct ${listItems.id})::int`,
      saveCount: sql<number>`count(distinct ${saves.userId})::int`,
      likeCount: sql<number>`(select count(*)::int from ${votes} v where v.target_type = 'list' and v.target_id = ${lists.id})`,
      ownerHandle: profiles.handle,
    })
    .from(lists)
    .leftJoin(listItems, eq(listItems.listId, lists.id))
    .leftJoin(saves, eq(saves.listId, lists.id))
    .innerJoin(profiles, eq(profiles.id, lists.ownerId))
    .where(
      and(eq(lists.isPublic, true), or(ilike(lists.title, pat), ilike(lists.description, pat))),
    )
    .groupBy(lists.id, profiles.handle)
    .orderBy(desc(lists.updatedAt))
    .limit(limitEach);

  return {
    products: productRows,
    lists: listRows.map((r) => ({
      ...r.list,
      itemCount: r.itemCount,
      saveCount: r.saveCount,
      likeCount: r.likeCount,
      ownerHandle: r.ownerHandle,
    })),
  };
}
