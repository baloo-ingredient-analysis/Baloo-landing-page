import { NextResponse, after } from "next/server";
import { requireApiKey } from "@/lib/apiAuth";
import { checkLimit, tooMany } from "@/lib/ratelimit";
import { scrapeAndExtract } from "@/lib/analysis/pipeline";
import { searchWeb } from "@/lib/firecrawl";
import { analyseAndCache } from "@/lib/apiV1Analysis";
import { ingestAnalysis } from "@/lib/ingest";

// POST /api/v1/find-product — the scrape/search backstop (mobile integration, see
// docs/API_CONTRACT_V1.md). For niche products the app's sources (OFF/Go-UPC) can't find.
//
// Give a direct `url` (reliable) or a `query` (best-effort: Firecrawl search → try the top results).
// `analyse: true` (default) chains straight into the shared analysis engine and returns the full
// result in one call; `analyse: false` returns the raw extraction only. Additive; nothing in the
// paste flow changes.
export const runtime = "nodejs";
export const maxDuration = 60;

type Body = { url?: string; query?: string; analyse?: boolean };

// Cost bound: never scrape+extract more than this many candidates for a query (each is a paid
// Firecrawl scrape + Claude extract). A direct url is always a single candidate.
const MAX_CANDIDATES = 3;

const FRIENDLY_NOT_FOUND =
  "We couldn't read that product. Try a direct product link from Whole Foods, Ocado, Tesco, Target, or Kroger.";

function bad(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

export async function POST(req: Request) {
  const gate = requireApiKey(req);
  if ("error" in gate) return gate.error;

  const rl = await checkLimit("apiV1", gate.keyId);
  if (!rl.ok) return tooMany(rl.reset);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return bad("Body must be valid JSON.");
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const query = typeof body.query === "string" ? body.query.trim() : "";
  const analyse = body.analyse !== false; // default true
  if (!url && !query) return bad("Provide `url` or `query`.");

  // Extraction always needs Firecrawl (scrape) + Claude (extract). If either is missing, say so
  // rather than returning a misleading "not found".
  if (!process.env.FIRECRAWL_API_KEY || !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "upstream_unavailable", message: "Product lookup is temporarily unavailable." },
      { status: 503 },
    );
  }

  // Candidate URLs: a direct link is one candidate; a query resolves to the top web results.
  const candidates = url ? [url] : (await searchWeb(query, MAX_CANDIDATES)).slice(0, MAX_CANDIDATES);
  if (candidates.length === 0) {
    return NextResponse.json({ error: "not_found", message: FRIENDLY_NOT_FOUND }, { status: 404 });
  }

  // Try candidates in order; stop at the first page that yields an ingredient list.
  let found: { extraction: NonNullable<Awaited<ReturnType<typeof scrapeAndExtract>>>; sourceUrl: string } | null = null;
  for (const candidate of candidates) {
    try {
      const extraction = await scrapeAndExtract(candidate);
      if (extraction?.ingredients_list?.length) {
        found = { extraction, sourceUrl: candidate };
        break;
      }
    } catch (err) {
      console.error("find-product scrape/extract error (trying next):", err);
    }
  }

  if (!found) {
    return NextResponse.json({ error: "not_found", message: FRIENDLY_NOT_FOUND }, { status: 404 });
  }

  const { extraction, sourceUrl } = found;

  // analyse: false → raw extraction only.
  if (!analyse) {
    return NextResponse.json({
      product_name: extraction.product_name,
      retailer: extraction.retailer,
      source_url: sourceUrl,
      ingredients_list: extraction.ingredients_list,
      percentages: extraction.percentages,
      nutrition: extraction.nutrition,
    });
  }

  // analyse: true → run the shared analyse/cache core, persist on a miss, return the full result.
  try {
    const { response, persist } = await analyseAndCache({
      name: extraction.product_name,
      retailer: extraction.retailer,
      url: sourceUrl,
      ingredients_list: extraction.ingredients_list,
      percentages: extraction.percentages,
      nutrition: extraction.nutrition,
    });
    if (persist) after(() => ingestAnalysis(persist));
    return NextResponse.json({ ...response, source_url: sourceUrl });
  } catch (err) {
    console.error("find-product analysis error:", err);
    return NextResponse.json(
      { error: "analysis_failed", message: "We found the product but couldn't analyse it. Please try again." },
      { status: 422 },
    );
  }
}
