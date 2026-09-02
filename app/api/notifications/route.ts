import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getNotifications } from "@/lib/db/queries/notifications";

// In-app notifications (N1): the signed-in user's recent notifications + unread count. Any signed-in
// user (a guest simply has none). Owner-scoped by construction. Load-time fetch; no polling.
export async function GET() {
  const gate = await requireUser();
  if ("error" in gate) return gate.error;
  const dbi = db();
  if (!dbi) return NextResponse.json({ notifications: [], unread: 0 });
  const data = await getNotifications(dbi, gate.user.id, 20);
  return NextResponse.json(data);
}
