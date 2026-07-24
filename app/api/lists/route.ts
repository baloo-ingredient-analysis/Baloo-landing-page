import { NextResponse } from "next/server";
import { requireUser, requireVerifiedUser } from "@/lib/auth";
import { checkLimit, tooMany } from "@/lib/ratelimit";
import { db } from "@/lib/db";
import { getProfileById } from "@/lib/db/queries/profiles";
import { createList, getListsByOwnerWithCounts } from "@/lib/db/queries/lists";
import { recordActivity } from "@/lib/db/queries/activity";
import { listSlug } from "@/lib/slug";

// GET my lists (editor + Add-to-list picker). POST create a list.
export async function GET() {
  const gate = await requireUser();
  if ("error" in gate) return gate.error;
  const dbi = db();
  if (!dbi) return NextResponse.json({ lists: [] });
  return NextResponse.json({ lists: await getListsByOwnerWithCounts(dbi, gate.user.id) });
}

export async function POST(req: Request) {
  const gate = await requireVerifiedUser();
  if ("error" in gate) return gate.error;
  const rl = await checkLimit("writeList", gate.user.id); // S4: lists/day
  if (!rl.ok) return tooMany(rl.reset);
  const dbi = db();
  if (!dbi) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });

  // lists.owner_id → profiles.id, so a handle must exist first.
  const profile = await getProfileById(dbi, gate.user.id);
  if (!profile) return NextResponse.json({ error: "needs_handle" }, { status: 409 });

  let body: { title?: string; description?: string; isPublic?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const title = (body.title ?? "").trim().slice(0, 120) || "Untitled list";

  // Retry once or twice on the (rare) slug collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const list = await createList(dbi, {
        ownerId: gate.user.id,
        title,
        slug: listSlug(title),
        description: body.description?.trim() || undefined,
        isPublic: body.isPublic ?? false,
      });
      await recordActivity(dbi, {
        actorId: gate.user.id,
        verb: "created_list",
        objectType: "list",
        objectId: list.id,
      });
      return NextResponse.json({ list: { id: list.id, slug: list.slug } });
    } catch (err) {
      if (attempt === 2) {
        console.error("createList error:", err);
        return NextResponse.json({ error: "create_failed" }, { status: 500 });
      }
    }
  }
  return NextResponse.json({ error: "create_failed" }, { status: 500 });
}
