import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { markNotificationsSeen } from "@/lib/db/queries/notifications";

// Mark all notifications seen (N1): stamps profiles.notifications_seen_at = now, clearing the badge.
// Called when the user opens the notifications panel.
export async function POST() {
  const gate = await requireUser();
  if ("error" in gate) return gate.error;
  const dbi = db();
  if (!dbi) return NextResponse.json({ ok: true });
  await markNotificationsSeen(dbi, gate.user.id);
  return NextResponse.json({ ok: true });
}
