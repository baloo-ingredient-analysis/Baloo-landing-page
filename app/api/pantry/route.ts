import { NextResponse } from "next/server";
import { requireUser, requireVerifiedUser } from "@/lib/auth";
import { checkLimit, tooMany } from "@/lib/ratelimit";
import { db } from "@/lib/db";
import { saveProduct, unsaveProduct } from "@/lib/db/queries/pantry";

// The Pantry (Order PP1): save/unsave a PRODUCT to your private collection. Mirrors /api/saves (which
// saves lists). POST needs a real account (guests analyse-only, S2) + a rate limit; DELETE only needs
// a session. Quiet by design — no activity row (a save isn't news).

export async function POST(req: Request) {
  const gate = await requireVerifiedUser();
  if ("error" in gate) return gate.error;
  const rl = await checkLimit("pantry", gate.user.id);
  if (!rl.ok) return tooMany(rl.reset);
  const dbi = db();
  if (!dbi) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });

  let body: { productId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.productId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  await saveProduct(dbi, gate.user.id, body.productId);
  return NextResponse.json({ saved: true });
}

export async function DELETE(req: Request) {
  const gate = await requireUser();
  if ("error" in gate) return gate.error;
  const dbi = db();
  if (!dbi) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });

  const productId = new URL(req.url).searchParams.get("productId");
  if (!productId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  await unsaveProduct(dbi, gate.user.id, productId);
  return NextResponse.json({ saved: false });
}
