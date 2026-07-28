// Saves (Order G7): bookmark a list to your profile. Quiet by design — no activity row, a
// bookmark isn't news (the D-G6 feed carries creates/adds/votes only).

import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../index";
import { listItems, lists, profiles, saves, votes } from "../schema";
import type { ListWithCountsAndOwner } from "./lists";

export async function saveList(dbi: Db, userId: string, listId: string): Promise<void> {
  await dbi.insert(saves).values({ userId, listId }).onConflictDoNothing();
}

export async function unsaveList(dbi: Db, userId: string, listId: string): Promise<void> {
  await dbi.delete(saves).where(and(eq(saves.userId, userId), eq(saves.listId, listId)));
}

export async function isSaved(dbi: Db, userId: string, listId: string): Promise<boolean> {
  const [row] = await dbi
    .select({ one: sql<number>`1` })
    .from(saves)
    .where(and(eq(saves.userId, userId), eq(saves.listId, listId)))
    .limit(1);
  return !!row;
}

// The profile Saved tab: a user's saved lists, newest-saved first. Visitors see public lists
// only; the owner also sees private ones they've saved.
export async function getSavedListsWithCounts(
  dbi: Db,
  userId: string,
  opts: { publicOnly: boolean },
): Promise<ListWithCountsAndOwner[]> {
  const rows = await dbi
    .select({
      list: lists,
      savedAt: saves.createdAt,
      itemCount: sql<number>`(select count(*)::int from ${listItems} li where li.list_id = ${lists.id})`,
      saveCount: sql<number>`(select count(*)::int from ${saves} s2 where s2.list_id = ${lists.id})`,
      likeCount: sql<number>`(select count(*)::int from ${votes} v where v.target_type = 'list' and v.target_id = ${lists.id})`,
      ownerHandle: profiles.handle,
    })
    .from(saves)
    .innerJoin(lists, eq(lists.id, saves.listId))
    .innerJoin(profiles, eq(profiles.id, lists.ownerId))
    .where(
      opts.publicOnly
        ? and(eq(saves.userId, userId), eq(lists.isPublic, true))
        : eq(saves.userId, userId),
    )
    .orderBy(desc(saves.createdAt));
  return rows.map((r) => ({
    ...r.list,
    itemCount: r.itemCount,
    saveCount: r.saveCount,
    likeCount: r.likeCount,
    ownerHandle: r.ownerHandle,
  }));
}
