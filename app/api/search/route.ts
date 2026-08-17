import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { searchAll } from "@/lib/db/queries/search";
import { searchOffCandidates } from "@/lib/openfoodfacts";
import { embedText, embeddingsEnabled } from "@/lib/embeddings";
import { checkLimit, clientIp, tooMany } from "@/lib/ratelimit";

export const runtime = "nodejs";

// Site search (Order G5 + SS3 + OFF4): public read. Returns three groups:
//  - products: already in our catalog (instant, full breakdown) — HYBRID semantic+keyword when
//    embeddings are configured, keyword otherwise;
//  - lists: public community lists;
//  - off: live Open Food Facts candidates NOT yet in our catalog — so search covers the whole OFF
//    database, not just what's been analysed. Picking one analyses it on demand (/api/off/lookup).
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const dbi = db();
  if (!dbi || q.trim().length < 2) return NextResponse.json({ products: [], lists: [], off: [] });

  // Embed the query for semantic search — only when enabled, and only then does it cost / rate-limit.
  let queryEmbedding: number[] | null = null;
  if (embeddingsEnabled()) {
    const rl = await checkLimit("search", clientIp(req));
    if (!rl.ok) return tooMany(rl.reset);
    queryEmbedding = await embedText(q);
  }

  // Viewer country from Vercel geo (country-level only, no PII) → light geo tiebreak on products (GR4).
  const country = req.headers.get("x-vercel-ip-country");

  // Catalog + OFF in parallel — OFF is a fast public service and optional-infra (returns [] on failure).
  // OFF candidates prefer the viewer's local market (same product, different ingredients per country).
  const [{ products, lists }, offRaw] = await Promise.all([
    searchAll(dbi, q, 10, queryEmbedding, country),
    searchOffCandidates(q, 8, country),
  ]);

  // Don't show an OFF candidate we already have in the catalog (dedupe by barcode).
  const known = new Set(products.map((p) => p.barcode).filter(Boolean));
  const off = offRaw.filter((c) => !known.has(c.barcode)).slice(0, 6);

  return NextResponse.json({
    products: products.map((p) => ({ id: p.id, name: p.name, brand: p.brand, slug: p.slug })),
    lists: lists.map((l) => ({
      id: l.id,
      slug: l.slug,
      title: l.title,
      isPublic: l.isPublic,
      itemCount: l.itemCount,
      likeCount: l.likeCount, // L8: likes are public; saveCount stays server-side (private signal)
      ownerHandle: l.ownerHandle,
    })),
    off, // [{ barcode, name, brand }]
  });
}
