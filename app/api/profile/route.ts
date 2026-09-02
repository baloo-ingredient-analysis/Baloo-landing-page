import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { changeHandle, getProfileByHandle, getProfileById, upsertProfile } from "@/lib/db/queries/profiles";
import { validateHandle } from "@/lib/handle";

// Handle setup / profile update (Order G2) — the first authenticated write in the codebase and
// the template for every G4+ write: requireUser gate, validate, friendly JSON errors only.
export async function POST(req: Request) {
  const gate = await requireUser();
  if ("error" in gate) return gate.error;
  const { user } = gate;

  const dbi = db();
  if (!dbi) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });

  let body: { handle?: string; displayName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const checked = validateHandle(body.handle ?? "");
  if (!checked.ok) {
    const error = checked.error === "reserved" ? "handle_reserved" : "invalid_handle";
    return NextResponse.json({ error, message: checked.message }, { status: 400 });
  }
  const handle = checked.handle;

  // Availability: the handle may be taken by someone else, but re-claiming your own is fine.
  const existing = await getProfileByHandle(dbi, handle);
  if (existing && existing.id !== user.id) {
    return NextResponse.json({ error: "handle_taken" }, { status: 409 });
  }

  const displayName =
    body.displayName?.trim() ||
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split("@")[0] ||
    handle;

  try {
    // A real handle CHANGE (existing profile, different handle) goes through changeHandle so the old
    // handle is kept as a permanent redirect (L5b). First-time setup / same-handle edits just upsert
    // — upsertProfile deliberately never rewrites the handle on conflict.
    const current = await getProfileById(dbi, user.id);
    const profile =
      current && current.handle !== handle
        ? await changeHandle(dbi, user.id, current.handle, handle, displayName)
        : await upsertProfile(dbi, { id: user.id, handle, displayName });
    return NextResponse.json({ profile });
  } catch (err) {
    // Unique-constraint race (two requests claiming one handle) lands here.
    console.error("profile upsert error:", err);
    return NextResponse.json({ error: "handle_taken" }, { status: 409 });
  }
}
