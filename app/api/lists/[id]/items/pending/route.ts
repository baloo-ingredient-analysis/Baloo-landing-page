import { NextResponse } from "next/server";
import { requireVerifiedUser } from "@/lib/auth";
import { db, type Db } from "@/lib/db";
import { deletePendingItem, getListById, setPendingItemStatus } from "@/lib/db/queries/lists";

type Params = { params: Promise<{ id: string }> };

// Owner gate, mirrors the parent items route: authed + owns the list.
async function guard(
  params: Params["params"],
): Promise<{ dbi: Db; listId: string } | { error: NextResponse }> {
  const gate = await requireVerifiedUser();
  if ("error" in gate) return { error: gate.error };
  const dbi = db();
  if (!dbi) return { error: NextResponse.json({ error: "db_not_configured" }, { status: 503 }) };
  const { id } = await params;
  const list = await getListById(dbi, id);
  if (!list) return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  if (list.ownerId !== gate.user.id)
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { dbi, listId: id };
}

// PATCH a pending item's status { barcode, status: 'failed' | 'analysing' } — the editor flips it to
// 'failed' when an analysis errors so the state survives a reload (and back to 'analysing' on retry).
export async function PATCH(req: Request, { params }: Params) {
  const g = await guard(params);
  if ("error" in g) return g.error;
  let body: { barcode?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.barcode || (body.status !== "failed" && body.status !== "analysing")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  await setPendingItemStatus(g.dbi, g.listId, body.barcode, body.status);
  return NextResponse.json({ ok: true });
}

// DELETE a pending item (?barcode=…) — dismiss a failed one, or clean up after it resolves into a
// real list item.
export async function DELETE(req: Request, { params }: Params) {
  const g = await guard(params);
  if ("error" in g) return g.error;
  const barcode = new URL(req.url).searchParams.get("barcode");
  if (!barcode) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  await deletePendingItem(g.dbi, g.listId, barcode);
  return NextResponse.json({ ok: true });
}
