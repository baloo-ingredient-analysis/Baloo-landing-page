import { NextResponse } from "next/server";
import { requireUser, requireVerifiedUser } from "@/lib/auth";
import { checkLimit, tooMany } from "@/lib/ratelimit";
import { db } from "@/lib/db";
import { followUser, unfollowUser } from "@/lib/db/queries/follows";
import { recordActivity } from "@/lib/db/queries/activity";

// Follow / unfollow (Order G6). POST { followingId } · DELETE ?followingId=…

export async function POST(req: Request) {
  const gate = await requireVerifiedUser();
  if ("error" in gate) return gate.error;
  const rl = await checkLimit("follow", gate.user.id); // S4: follows/minute
  if (!rl.ok) return tooMany(rl.reset);
  const dbi = db();
  if (!dbi) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });

  let body: { followingId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.followingId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (body.followingId === gate.user.id)
    return NextResponse.json({ error: "cannot_follow_self" }, { status: 400 });

  const ok = await followUser(dbi, gate.user.id, body.followingId);
  if (ok) {
    await recordActivity(dbi, {
      actorId: gate.user.id,
      verb: "followed",
      objectType: "profile",
      objectId: body.followingId,
    });
  }
  return NextResponse.json({ ok });
}

export async function DELETE(req: Request) {
  const gate = await requireUser();
  if ("error" in gate) return gate.error;
  const dbi = db();
  if (!dbi) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });

  const followingId = new URL(req.url).searchParams.get("followingId");
  if (!followingId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  await unfollowUser(dbi, gate.user.id, followingId);
  return NextResponse.json({ ok: true });
}
