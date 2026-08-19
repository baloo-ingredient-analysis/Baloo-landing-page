import { NextResponse } from "next/server";
import { lookupCommercialMany, commercialDbEnabled, commercialDbProvider } from "@/lib/commercialdb";

export const runtime = "nodejs";
export const maxDuration = 30;

// Commercial-DB half of /compare (feat/off-compare): given the barcodes OFF surfaced, look each up in
// the configured paid barcode database (BarcodeNest / Chomp) so we can put the SAME product's
// ingredients next to OFF's. Optional-infra: no key -> { configured:false }. Internal tool; the lib
// caps + dedupes barcodes to protect the credit budget (these are paid calls).
export async function POST(req: Request) {
  if (!commercialDbEnabled()) {
    return NextResponse.json({ configured: false, provider: null, results: [] });
  }
  let body: { barcodes?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ configured: true, provider: commercialDbProvider(), results: [] });
  }
  const barcodes = Array.isArray(body.barcodes)
    ? body.barcodes.filter((b): b is string => typeof b === "string")
    : [];
  const results = await lookupCommercialMany(barcodes, 10);
  return NextResponse.json({ configured: true, provider: commercialDbProvider(), results });
}
