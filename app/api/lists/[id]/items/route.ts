import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { requireVerifiedUser } from "@/lib/auth";
import { checkLimit, tooMany, MAX_ITEMS_PER_LIST } from "@/lib/ratelimit";
import { db, type Db } from "@/lib/db";
import {
  addListItem,
  addPendingItem,
  countListItems,
  getListById,
  removeListItem,
  reorderListItems,
  setListItemNote,
} from "@/lib/db/queries/lists";
import { recordActivity } from "@/lib/db/queries/activity";

type Params = { params: Promise<{ id: string }> };

// Shared gate: authed + owns the list. Returns the db + list id, or an error response.
async function guard(
  params: Params["params"],
): Promise<{ dbi: Db; listId: string; user: User } | { error: NextResponse }> {
  const gate = await requireVerifiedUser();
  if ("error" in gate) return { error: gate.error };
  const dbi = db();
  if (!dbi) return { error: NextResponse.json({ error: "db_not_configured" }, { status: 503 }) };
  const { id } = await params;
  const list = await getListById(dbi, id);
  if (!list) return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  if (list.ownerId !== gate.user.id)
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { dbi, listId: id, user: gate.user };
}

// POST add a product { productId, note? }.
export async function POST(req: Request, { params }: Params) {
  const g = await guard(params);
  if ("error" in g) return g.error;
  const rl = await checkLimit("listItem", g.user.id); // S4: add-to-list rate
  if (!rl.ok) return tooMany(rl.reset);
  // S4 hard cap (always on, not Upstash-dependent): a list can't grow past MAX_ITEMS_PER_LIST.
  if ((await countListItems(g.dbi, g.listId)) >= MAX_ITEMS_PER_LIST) {
    return NextResponse.json(
      { error: "list_full", message: `A list can hold up to ${MAX_ITEMS_PER_LIST} products.` },
      { status: 409 },
    );
  }
  let body: { productId?: string; note?: string; barcode?: string; name?: string; brand?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Pending (analyse-and-add) path: an OFF pick still being analysed. Persist a placeholder so the
  // analysis survives a reload; the editor attaches the real product (a normal add) once it resolves.
  if (!body.productId && body.barcode && body.name) {
    const pending = await addPendingItem(g.dbi, g.listId, {
      barcode: body.barcode,
      name: body.name,
      brand: body.brand?.trim() || null,
    });
    return NextResponse.json({ pending });
  }

  if (!body.productId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const item = await addListItem(g.dbi, g.listId, body.productId, body.note?.trim() || undefined);
  await recordActivity(g.dbi, {
    actorId: g.user.id,
    verb: "added_item",
    objectType: "list",
    objectId: g.listId,
    meta: { productId: body.productId }, // lets the feed name the product (G6)
  });
  return NextResponse.json({ item });
}

// DELETE remove a product (?productId=…).
export async function DELETE(req: Request, { params }: Params) {
  const g = await guard(params);
  if ("error" in g) return g.error;
  const productId = new URL(req.url).searchParams.get("productId");
  if (!productId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  await removeListItem(g.dbi, g.listId, productId);
  return NextResponse.json({ ok: true });
}

// PATCH a curator note on an item { productId, note }.
export async function PATCH(req: Request, { params }: Params) {
  const g = await guard(params);
  if ("error" in g) return g.error;
  let body: { productId?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.productId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  await setListItemNote(g.dbi, g.listId, body.productId, body.note?.trim() || null);
  return NextResponse.json({ ok: true });
}

// PUT reorder — full order { order: productId[] }.
export async function PUT(req: Request, { params }: Params) {
  const g = await guard(params);
  if ("error" in g) return g.error;
  let body: { order?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!Array.isArray(body.order)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  await reorderListItems(g.dbi, g.listId, body.order);
  return NextResponse.json({ ok: true });
}
