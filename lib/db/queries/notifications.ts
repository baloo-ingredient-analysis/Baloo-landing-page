// In-app notifications (N1). The activity log (G6) only records who DID what, not who it's FOR, so
// we derive a user's notifications straight from the source tables — the events that involve THEM as
// the recipient: a new follower, and likes/saves on one of their lists. Product comments have no
// per-user recipient in this model, so they're deliberately out of v1.
//
// Unread is a single marker (`profiles.notifications_seen_at`): anything newer is unread. Callers own
// the db() null-guard + auth (owner-scoped by construction — everything is keyed to `userId`).

import { and, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import type { Db } from "../index";
import { follows, lists, profiles, saves, votes } from "../schema";

export type NotificationActor = { handle: string; displayName: string };
export type Notification =
  | { kind: "followed"; ts: string; actor: NotificationActor }
  | {
      kind: "liked_list" | "saved_list";
      ts: string;
      actor: NotificationActor;
      list: { title: string; slug: string };
    };

export async function markNotificationsSeen(dbi: Db, userId: string): Promise<void> {
  await dbi.update(profiles).set({ notificationsSeenAt: sql`now()` }).where(eq(profiles.id, userId));
}

// The recent notifications for a user, newest first, plus how many are unread (newer than the marker).
export async function getNotifications(
  dbi: Db,
  userId: string,
  limit = 20,
): Promise<{ notifications: Notification[]; unread: number }> {
  const [me] = await dbi
    .select({ seenAt: profiles.notificationsSeenAt })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  const seenAt = me?.seenAt ?? null;

  const myLists = await dbi
    .select({ id: lists.id, title: lists.title, slug: lists.slug })
    .from(lists)
    .where(eq(lists.ownerId, userId));
  const listMap = new Map(myLists.map((l) => [l.id, { title: l.title, slug: l.slug }]));
  const listIds = myLists.map((l) => l.id);

  const out: Notification[] = [];

  // New followers.
  const followRows = await dbi
    .select({ ts: follows.createdAt, handle: profiles.handle, displayName: profiles.displayName })
    .from(follows)
    .innerJoin(profiles, eq(profiles.id, follows.followerId))
    .where(eq(follows.followingId, userId))
    .orderBy(desc(follows.createdAt))
    .limit(limit);
  for (const r of followRows) {
    out.push({ kind: "followed", ts: r.ts.toISOString(), actor: { handle: r.handle, displayName: r.displayName } });
  }

  // Likes + saves on my lists (someone else's — never my own action).
  if (listIds.length > 0) {
    const likeRows = await dbi
      .select({ ts: votes.createdAt, listId: votes.targetId, handle: profiles.handle, displayName: profiles.displayName })
      .from(votes)
      .innerJoin(profiles, eq(profiles.id, votes.userId))
      .where(and(eq(votes.targetType, "list"), inArray(votes.targetId, listIds), ne(votes.userId, userId)))
      .orderBy(desc(votes.createdAt))
      .limit(limit);
    for (const r of likeRows) {
      const list = listMap.get(r.listId);
      if (list) out.push({ kind: "liked_list", ts: r.ts.toISOString(), actor: { handle: r.handle, displayName: r.displayName }, list });
    }

    const saveRows = await dbi
      .select({ ts: saves.createdAt, listId: saves.listId, handle: profiles.handle, displayName: profiles.displayName })
      .from(saves)
      .innerJoin(profiles, eq(profiles.id, saves.userId))
      .where(and(inArray(saves.listId, listIds), ne(saves.userId, userId)))
      .orderBy(desc(saves.createdAt))
      .limit(limit);
    for (const r of saveRows) {
      const list = listMap.get(r.listId);
      if (list) out.push({ kind: "saved_list", ts: r.ts.toISOString(), actor: { handle: r.handle, displayName: r.displayName }, list });
    }
  }

  out.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  const notifications = out.slice(0, limit);
  const unread = seenAt
    ? notifications.filter((n) => new Date(n.ts) > seenAt).length
    : notifications.length; // never opened → everything shown is unread
  return { notifications, unread };
}
