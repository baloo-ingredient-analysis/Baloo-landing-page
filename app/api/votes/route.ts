import { NextResponse } from "next/server";
import { requireVerifiedUser } from "@/lib/auth";
import { checkLimit, tooMany } from "@/lib/ratelimit";
import { db } from "@/lib/db";
import { toggleVote, type VotableType } from "@/lib/db/queries/votes";

// Votes power two signals (Order L8 re-widens the L6 chokepoint): a LIST vote is a public Like
// (feeds "Popular"/Explore ranking), a COMMENT vote is agreement (drives the thread's "Top" sort).
// PRODUCTS still carry no vote — their one action is "Add to my list". Single direction — no
// downvote, by design. Both are too light for the feed, so this route writes no activity.
const VOTABLE: VotableType[] = ["comment", "list"];

export async function POST(req: Request) {
  const gate = await requireVerifiedUser();
  if ("error" in gate) return gate.error;
  const rl = await checkLimit("vote", gate.user.id); // S4: votes/minute
  if (!rl.ok) return tooMany(rl.reset);
  const dbi = db();
  if (!dbi) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });

  let body: { targetType?: string; targetId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const targetType = body.targetType as VotableType;
  if (!VOTABLE.includes(targetType) || !body.targetId) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const result = await toggleVote(dbi, gate.user.id, targetType, body.targetId);
  return NextResponse.json(result);
}
