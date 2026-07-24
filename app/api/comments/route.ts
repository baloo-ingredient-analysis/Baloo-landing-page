import { NextResponse } from "next/server";
import { requireUser, requireVerifiedUser, getSessionUser } from "@/lib/auth";
import { checkLimit, tooMany } from "@/lib/ratelimit";
import { db } from "@/lib/db";
import { addComment, deleteOwnComment, getThread, type ThreadSort } from "@/lib/db/queries/comments";
import { recordActivity } from "@/lib/db/queries/activity";

// Product discussion (Order G8a). Reads are public; posting requires auth.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const productId = url.searchParams.get("productId");
  const sort: ThreadSort = url.searchParams.get("sort") === "newest" ? "newest" : "top";
  if (!productId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const dbi = db();
  if (!dbi) return NextResponse.json({ comments: [] });

  const viewer = await getSessionUser();
  const thread = await getThread(dbi, productId, { sort, viewerId: viewer?.id ?? null });
  return NextResponse.json({ comments: thread });
}

export async function POST(req: Request) {
  const gate = await requireVerifiedUser();
  if ("error" in gate) return gate.error;
  const rl = await checkLimit("comment", gate.user.id); // S4: comments/minute
  if (!rl.ok) return tooMany(rl.reset);
  const dbi = db();
  if (!dbi) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });

  let body: { productId?: string; body?: string; parentId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const text = (body.body ?? "").trim();
  if (!body.productId || text.length < 1 || text.length > 1000) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const res = await addComment(dbi, {
    userId: gate.user.id,
    productId: body.productId,
    body: text,
    parentId: body.parentId ?? null,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });

  await recordActivity(dbi, {
    actorId: gate.user.id,
    verb: "commented",
    objectType: "product",
    objectId: body.productId,
  });
  return NextResponse.json({ id: res.id });
}

// Author self-delete (Order G9): soft-hide, ownership enforced in the query.
export async function DELETE(req: Request) {
  const gate = await requireUser();
  if ("error" in gate) return gate.error;
  const dbi = db();
  if (!dbi) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const ok = await deleteOwnComment(dbi, id, gate.user.id);
  if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ ok: true });
}
