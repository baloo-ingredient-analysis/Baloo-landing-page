import { NextResponse } from "next/server";
import { requireVerifiedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getRecentProductsForOwner } from "@/lib/db/queries/lists";

// The list builder's "recents" strip (P3): the signed-in owner's most-recently-added products, shown
// in the picker before they type. Owner-scoped (their own adds only) — no list id needed.
export async function GET() {
  const gate = await requireVerifiedUser();
  if ("error" in gate) return gate.error;
  const dbi = db();
  if (!dbi) return NextResponse.json({ products: [] });
  const products = await getRecentProductsForOwner(dbi, gate.user.id, 8);
  return NextResponse.json({ products });
}
