import { NextResponse } from "next/server";
import { requireVerifiedUser } from "@/lib/auth";
import { checkLimit, tooMany } from "@/lib/ratelimit";
import { db } from "@/lib/db";
import { createReport } from "@/lib/db/queries/reports";
import { getListById } from "@/lib/db/queries/lists";
import type { ReportTargetType } from "@/lib/db/schema";
import { comments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const REPORTABLE: ReportTargetType[] = ["comment", "list"];
const REASONS = new Set(["spam", "abuse", "off_topic", "other"]);

// Flag a comment or list (Order G9). Requires auth; dedups an existing open report.
export async function POST(req: Request) {
  const gate = await requireVerifiedUser();
  if ("error" in gate) return gate.error;
  const rl = await checkLimit("report", gate.user.id); // S4: reports/5-min
  if (!rl.ok) return tooMany(rl.reset);
  const dbi = db();
  if (!dbi) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });

  let body: { targetType?: string; targetId?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const targetType = body.targetType as ReportTargetType;
  const reason = body.reason ?? "other";
  if (!REPORTABLE.includes(targetType) || !body.targetId || !REASONS.has(reason)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // The target must exist (and, for lists, be reachable — no reporting things you can't see).
  if (targetType === "list") {
    const list = await getListById(dbi, body.targetId);
    if (!list || (!list.isPublic && list.ownerId !== gate.user.id)) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  } else {
    const [c] = await dbi.select({ id: comments.id }).from(comments).where(eq(comments.id, body.targetId)).limit(1);
    if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await createReport(dbi, {
    reporterId: gate.user.id,
    targetType,
    targetId: body.targetId,
    reason,
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
