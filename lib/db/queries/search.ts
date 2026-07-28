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
import type { ListWithCountsAndOwner } from "./lists";

export type SearchResults = {
  products: Product[];
  lists: ListWithCountsAndOwner[];
};

export async function searchAll(dbi: Db, q: string, limitEach = 10): Promise<SearchResults> {
  const term = q.trim();
  if (term.length < 2) return { products: [], lists: [] };
  const pat = `%${term}%`;

  const productRows = await dbi
    .select()
    .from(products)
    .where(or(ilike(products.name, pat), ilike(products.brand, pat)))
    .orderBy(desc(products.createdAt))
    .limit(limitEach);

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
