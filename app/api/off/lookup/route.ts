import { NextResponse } from "next/server";
import { importOffByBarcode, importOffByQuery } from "@/lib/offImport";
import { checkLimit, clientIp, tooMany } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

// OFF live-lookup (Order OFF3): the web's "not in our catalog yet" path. Given a name query (search
// miss) or a barcode, pull the product from Open Food Facts, analyse it once, cache it in the catalog,
// and return its slug so the caller can go straight to the product page. A known product is reused
// with no Claude call (importOff short-circuits on the barcode).
//
// Public + rate-limited by IP, same posture as the paste analyse path. Optional-infra: a typed error,
// never a raw failure.
export async function POST(req: Request) {
  const rl = await checkLimit("offLookup", clientIp(req));
  if (!rl.ok) return tooMany(rl.reset);

  let body: { query?: unknown; barcode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const barcode = typeof body.barcode === "string" ? body.barcode.trim() : "";
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!barcode && query.length < 2) {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const result = barcode ? await importOffByBarcode(barcode) : await importOffByQuery(query);

  if (!result.ok) {
    // not_found is a normal "we couldn't find it" (404); the rest are 503-ish infra states.
    const status = result.reason === "not_found" || result.reason === "no_ingredients" ? 404 : 503;
    return NextResponse.json({ ok: false, reason: result.reason }, { status });
  }
  return NextResponse.json({ ok: true, slug: result.slug, reused: result.reused });
}
