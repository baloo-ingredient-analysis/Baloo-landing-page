import { NextResponse, after } from "next/server";
import { requireUser, requireVerifiedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteList, generateAndStoreListMeta, getListById, updateList } from "@/lib/db/queries/lists";

type Params = { params: Promise<{ id: string }> };

// PATCH list fields (title/description/isPublic/coverUrl). DELETE the list.
export async function PATCH(req: Request, { params }: Params) {
  const gate = await requireVerifiedUser();
  if ("error" in gate) return gate.error;
  const dbi = db();
  if (!dbi) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
  const { id } = await params;

  const list = await getListById(dbi, id);
  if (!list) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (list.ownerId !== gate.user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { title?: string; description?: string | null; isPublic?: boolean; coverUrl?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title.trim().slice(0, 120) || list.title;
  if (body.description !== undefined) patch.description = body.description?.trim() || null;
  if (typeof body.isPublic === "boolean") patch.isPublic = body.isPublic;
  if (body.coverUrl !== undefined) patch.coverUrl = body.coverUrl;

  const updated = await updateList(dbi, id, patch);
  // Regenerate tags + discovery in the background when the meaningful signal changed (edit or publish).
  // Fire-and-forget: never slow or break the edit. By this point the list usually has its products.
  if (patch.title !== undefined || patch.description !== undefined || patch.isPublic !== undefined) {
    after(() => generateAndStoreListMeta(dbi, id).catch(() => {}));
  }
  return NextResponse.json({ list: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  const gate = await requireUser();
  if ("error" in gate) return gate.error;
  const dbi = db();
  if (!dbi) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
  const { id } = await params;

  const list = await getListById(dbi, id);
  if (!list) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (list.ownerId !== gate.user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await deleteList(dbi, id);
  return NextResponse.json({ ok: true });
}
