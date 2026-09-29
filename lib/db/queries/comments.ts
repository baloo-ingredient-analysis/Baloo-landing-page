// Product discussion (Order G8). The thread is product-scoped and one level deep — a paper, not
// a forum (D-G7/G8 handoff §4). Community comments are opinion; the factual answer comes from
// Baloo's "Explain this" card (G8b), never from a vote on a comment.

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../index";
import { comments, products, profiles, votes } from "../schema";

export type CommentAuthor = { handle: string; displayName: string };
export type ProductRef = { slug: string; name: string };
export type ThreadComment = {
  id: string;
  body: string;
  ts: string; // ISO
  author: CommentAuthor;
  votes: number;
  viewerVoted: boolean;
  hidden: boolean; // moderated or author-deleted → render a tombstone (G9)
  // Lets the client show the owner's Delete affordance. Null since S7a: the author deleted their
  // account, so the comment is an ownerless tombstone — no viewer id can ever match, which is right.
  authorId: string | null;
  // Product references (roadmap 1a): products the comment links via a /p/<slug> URL in its body.
  // Resolved to name + slug here; the raw token is stripped from `body` and rendered as a chip.
  productRefs: ProductRef[];
  replies: ThreadComment[]; // one level; always chronological
};

// A Baloo product link inside comment text — relative (`/p/slug`) or absolute
// (`https://baloo.life/p/slug`). Factory (not a shared const) so the global regex's lastIndex is
// never carried between matchAll/replace calls. Slugs are generated lowercase.
const productRefRe = () => /\s*(?:https?:\/\/[^\s/]+)?\/p\/([a-z0-9][a-z0-9-]*)/gi;

function extractProductSlugs(body: string): string[] {
  return [...body.matchAll(productRefRe())].map((m) => m[1].toLowerCase());
}

// Strip resolved product links out of the display body and return them as chips. An unresolved
// /p/xxx (no matching product) is left in the text untouched — it wasn't a real reference.
function resolveRefs(body: string, refMap: Map<string, string>): { body: string; refs: ProductRef[] } {
  const refs: ProductRef[] = [];
  const seen = new Set<string>();
  const cleaned = body
    .replace(productRefRe(), (full, slug: string) => {
      const key = slug.toLowerCase();
      const name = refMap.get(key);
      if (!name) return full;
      if (!seen.has(key)) {
        seen.add(key);
        refs.push({ slug: key, name });
      }
      return "";
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { body: cleaned, refs };
}

export type ThreadSort = "top" | "newest";

// A comment thread hangs off EITHER a product or a list (L-community). One target per call.
export type CommentTarget = { productId: string } | { listId: string };
const targetEq = (t: CommentTarget) =>
  "productId" in t ? eq(comments.productId, t.productId) : eq(comments.listId, t.listId);

export async function getCommentCount(dbi: Db, target: CommentTarget): Promise<number> {
  const [row] = await dbi
    .select({ n: sql<number>`count(*)::int` })
    .from(comments)
    .where(targetEq(target));
  return row?.n ?? 0;
}

// The whole thread for a product OR list, hydrated (author + vote count + viewer's vote), bulk — no N+1.
export async function getThread(
  dbi: Db,
  target: CommentTarget,
  opts: { sort: ThreadSort; viewerId?: string | null },
): Promise<ThreadComment[]> {
  const rows = await dbi
    .select({ c: comments, handle: profiles.handle, displayName: profiles.displayName })
    .from(comments)
    .innerJoin(profiles, eq(profiles.id, comments.userId))
    .where(targetEq(target));
  if (rows.length === 0) return [];

  // Bulk vote hydration for every comment in the thread.
  const ids = rows.map((r) => r.c.id);
  const countRows = await dbi
    .select({ targetId: votes.targetId, n: sql<number>`count(*)::int` })
    .from(votes)
    .where(and(eq(votes.targetType, "comment"), inArray(votes.targetId, ids)))
    .groupBy(votes.targetId);
  const counts = new Map(countRows.map((r) => [r.targetId, r.n]));
  const voted = opts.viewerId
    ? new Set(
        (
          await dbi
            .select({ targetId: votes.targetId })
            .from(votes)
            .where(
              and(
                eq(votes.userId, opts.viewerId),
                eq(votes.targetType, "comment"),
                inArray(votes.targetId, ids),
              ),
            )
        ).map((r) => r.targetId),
      )
    : new Set<string>();

  // Resolve every /p/<slug> referenced across the thread to a product name, in one bulk query.
  const refSlugs = [
    ...new Set(rows.flatMap((r) => (r.c.hiddenAt ? [] : extractProductSlugs(r.c.body)))),
  ];
  const refMap = new Map<string, string>();
  if (refSlugs.length > 0) {
    const prods = await dbi
      .select({ slug: products.slug, name: products.name })
      .from(products)
      .where(inArray(products.slug, refSlugs));
    for (const p of prods) refMap.set(p.slug, p.name);
  }

  const toNode = (r: (typeof rows)[number]): ThreadComment => {
    const hidden = !!r.c.hiddenAt;
    // Tombstone: hidden content leaks neither its text, author, nor its references.
    const resolved = hidden ? { body: "", refs: [] as ProductRef[] } : resolveRefs(r.c.body, refMap);
    return {
      id: r.c.id,
      body: resolved.body,
      ts: r.c.createdAt.toISOString(),
      author: hidden
        ? { handle: "", displayName: "" }
        : { handle: r.handle, displayName: r.displayName },
      votes: hidden ? 0 : (counts.get(r.c.id) ?? 0),
      viewerVoted: hidden ? false : voted.has(r.c.id),
      hidden,
      authorId: r.c.userId,
      productRefs: resolved.refs,
      replies: [],
    };
  };

  const nodes = new Map(rows.map((r) => [r.c.id, toNode(r)]));
  const tops: { node: ThreadComment; ts: number }[] = [];
  for (const r of rows) {
    const node = nodes.get(r.c.id)!;
    if (r.c.parentId) {
      nodes.get(r.c.parentId)?.replies.push(node); // parent is always top-level (one-level cap)
    } else {
      tops.push({ node, ts: r.c.createdAt.getTime() });
    }
  }

  // Replies always chronological under their parent.
  for (const n of nodes.values())
    n.replies.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));

  tops.sort((a, b) =>
    opts.sort === "top" ? b.node.votes - a.node.votes || b.ts - a.ts : b.ts - a.ts,
  );
  return tops.map((t) => t.node);
}

// Post a comment or a reply. One-level cap enforced here as the last line of defence.
export async function addComment(
  dbi: Db,
  input: { userId: string; target: CommentTarget; body: string; parentId?: string | null },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const productId = "productId" in input.target ? input.target.productId : null;
  const listId = "listId" in input.target ? input.target.listId : null;
  if (input.parentId) {
    const [parent] = await dbi
      .select({
        parentId: comments.parentId,
        productId: comments.productId,
        listId: comments.listId,
      })
      .from(comments)
      .where(eq(comments.id, input.parentId))
      .limit(1);
    // The parent must live on the SAME target (can't reply across products/lists).
    if (!parent || parent.productId !== productId || parent.listId !== listId)
      return { ok: false, error: "bad_parent" };
    if (parent.parentId) return { ok: false, error: "no_nested_replies" };
  }
  const [row] = await dbi
    .insert(comments)
    .values({ userId: input.userId, productId, listId, body: input.body, parentId: input.parentId ?? null })
    .returning({ id: comments.id });
  return { ok: true, id: row.id };
}

// Soft moderation (Order G9). Reversible; the row stays for audit + thread structure.
export async function hideComment(dbi: Db, id: string, by: "author" | "moderator"): Promise<void> {
  await dbi
    .update(comments)
    .set({ hiddenAt: new Date(), hiddenBy: by })
    .where(eq(comments.id, id));
}

export async function unhideComment(dbi: Db, id: string): Promise<void> {
  await dbi.update(comments).set({ hiddenAt: null, hiddenBy: null }).where(eq(comments.id, id));
}

// Author self-delete: soft-hide, ownership enforced. Returns false if not the author's comment.
export async function deleteOwnComment(dbi: Db, id: string, userId: string): Promise<boolean> {
  const res = await dbi
    .update(comments)
    .set({ hiddenAt: new Date(), hiddenBy: "author" })
    .where(and(eq(comments.id, id), eq(comments.userId, userId)))
    .returning({ id: comments.id });
  return res.length > 0;
}

// Explain-this (G8b) grounding: product name + the comment being explained.
export async function getCommentForExplain(
  dbi: Db,
  commentId: string,
): Promise<{ productId: string | null; body: string } | null> {
  // productId is null for a LIST comment — "Explain this" is product-grounded, so the caller treats a
  // null product as "can't explain" (the UI already hides the affordance for list threads).
  const [row] = await dbi
    .select({ productId: comments.productId, body: comments.body })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);
  return row ?? null;
}
