import { NextResponse } from "next/server";
import { requireUser, requireVerifiedUser } from "@/lib/auth";
import { checkLimit, tooMany } from "@/lib/ratelimit";
import { db } from "@/lib/db";
import { getListById } from "@/lib/db/queries/lists";
import { saveList, unsaveList } from "@/lib/db/queries/saves";

// Save / unsave a list (Order G7). Quiet: no activity row — a bookmark isn't news.
export async function POST(req: Request) {
  const gate = await requireVerifiedUser();
  if ("error" in gate) return gate.error;
  const rl = await checkLimit("save", gate.user.id); // S4: saves/minute
  if (!rl.ok) return tooMany(rl.reset);
  const dbi = db();
  if (!dbi) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });

  let body: { listId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.listId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  // Only public lists (or your own) are saveable — no bookmarking things you can't see.
  const list = await getListById(dbi, body.listId);
  if (!list || (!list.isPublic && list.ownerId !== gate.user.id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await saveList(dbi, gate.user.id, body.listId);
  return NextResponse.json({ saved: true });
}

export async function DELETE(req: Request) {
  const gate = await requireUser();
  if ("error" in gate) return gate.error;
  const dbi = db();
  if (!dbi) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });

  const listId = new URL(req.url).searchParams.get("listId");
  if (!listId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  await unsaveList(dbi, gate.user.id, listId);
  return NextResponse.json({ saved: false });
}
