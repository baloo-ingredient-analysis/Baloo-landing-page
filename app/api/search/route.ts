import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { searchAll } from "@/lib/db/queries/search";
import { searchOffCandidates } from "@/lib/openfoodfacts";
import { productDedupKey, normalizeName } from "@/lib/canonical";
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

  // Viewer country: Vercel geo in prod (country-level, no PII); OFF_DEFAULT_COUNTRY as a fallback for
  // local dev / a beta default market. Scopes OFF search to that market + the GR4 geo tiebreak.
  const country = req.headers.get("x-vercel-ip-country") || process.env.OFF_DEFAULT_COUNTRY || null;

  // Catalog + OFF in parallel — OFF is a fast public service and optional-infra (returns [] on failure).
  // OFF candidates prefer the viewer's local market (same product, different ingredients per country).
  const [{ products, lists }, offRaw] = await Promise.all([
    searchAll(dbi, q, 10, queryEmbedding, country),
    searchOffCandidates(q, 12, country),
  ]);

  // Collapse near-duplicate SKUs of the SAME product across the unified list (catalog first, then OFF)
  // so size/format/case/accent variants of one drink don't flood a query. Catalog wins — it has the
  // full breakdown. `seen` accumulates across both sources; OFF is also deduped by barcode against the
  // catalog. Genuinely different products keep distinct names, so they still show separately.
  // The query's own words carry no identity for THIS search (every "oatly" hit says "oatly"), so we
  // strip them before deduping — collapsing "Oatly Oat Drink Barista" into "Oat Drink Barista".
  const qTokens = new Set(normalizeName(q).split(" ").filter(Boolean));
  const seen = new Set<string>();
  const dedupProducts = products.filter((p) => {
    const k = productDedupKey({ name: p.name, brand: p.brand }, qTokens);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const known = new Set(products.map((p) => p.barcode).filter(Boolean));
  const off: typeof offRaw = [];
  for (const c of offRaw) {
    if (known.has(c.barcode)) continue;
    const k = productDedupKey(c, qTokens);
    if (seen.has(k)) continue;
    seen.add(k);
    off.push(c);
    if (off.length >= 12) break;
  }

  // Rank by how much of the query each result actually matches (name + brand), so the closest products
  // lead within each group — e.g. the "…Zero" variants above "…Energy"/regular for "coca cola zero".
  // Stable: equal coverage keeps the source relevance/popularity order, and a brand-only query ("oatly")
  // ties every hit at full coverage → no-op.
  const coverage = (name: string, brand?: string | null) => {
    if (!qTokens.size) return 1;
    const hay = new Set(normalizeName(`${name} ${brand ?? ""}`).split(" "));
    let n = 0;
    for (const t of qTokens) if (hay.has(t)) n++;
    return n / qTokens.size;
  };
  const byCoverage = <T extends { name: string; brand?: string | null }>(rows: T[]): T[] =>
    rows
      .map((r, i) => ({ r, i }))
      .sort((a, b) => coverage(b.r.name, b.r.brand) - coverage(a.r.name, a.r.brand) || a.i - b.i)
      .map((x) => x.r);
  const rankedProducts = byCoverage(dedupProducts);
  const rankedOff = byCoverage(off);

  return NextResponse.json({
    products: rankedProducts.map((p) => ({ id: p.id, name: p.name, brand: p.brand, slug: p.slug })),
    lists: lists.map((l) => ({
      id: l.id,
      slug: l.slug,
      title: l.title,
      isPublic: l.isPublic,
      itemCount: l.itemCount,
      likeCount: l.likeCount, // L8: likes are public; saveCount stays server-side (private signal)
      ownerHandle: l.ownerHandle,
    })),
    off: rankedOff, // [{ barcode, name, brand }]
  });
}
