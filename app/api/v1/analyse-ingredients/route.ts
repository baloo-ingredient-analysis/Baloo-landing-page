import { NextResponse, after } from "next/server";
import { requireApiKey } from "@/lib/apiAuth";
import { checkLimit, tooMany } from "@/lib/ratelimit";
import { analyseAndCache } from "@/lib/apiV1Analysis";
import { ingestAnalysis } from "@/lib/ingest";
import type { Nutrition } from "@/lib/schema";

// POST /api/v1/analyse-ingredients — the "brain" (mobile integration, see docs/API_CONTRACT_V1.md).
//
// Mobile already has an ingredient list (from Open Food Facts / Vision). This runs Baloo's shared
// analysis engine (identical to the web) and returns the per-ingredient breakdown. A known product
// (deduped on canonical_key) returns from the catalog with NO model spend; a miss is analysed and
// persisted in after() so the next call hits. The analyse/cache core is shared with find-product
// via lib/apiV1Analysis. Everything additive; the paste-flow routes are untouched.
export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  product?: { name?: string; brand?: string; size?: string; retailer?: string; barcode?: string };
  ingredients?: string[];
  percentages?: { ingredient: string; percentage: string }[];
  nutrition?: Nutrition;
};

const MAX_INGREDIENTS = 200;

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

  const name = body.product?.name?.trim();
  if (!name) return bad("`product.name` is required.");

  const ingredients = (body.ingredients ?? [])
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ingredients.length === 0) return bad("`ingredients` must be a non-empty array of strings.");
  if (ingredients.length > MAX_INGREDIENTS) return bad(`Too many ingredients (max ${MAX_INGREDIENTS}).`);

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "upstream_unavailable", message: "Analysis is temporarily unavailable." },
      { status: 503 },
    );
  }

  try {
    const { response, persist } = await analyseAndCache({
      name,
      brand: body.product?.brand?.trim() || null,
      barcode: body.product?.barcode?.trim() || null,
      retailer: body.product?.retailer?.trim() || null,
      ingredients_list: ingredients,
      percentages: Array.isArray(body.percentages) ? body.percentages : [],
      nutrition: body.nutrition ?? null,
    });
    if (persist) after(() => ingestAnalysis(persist));
    return NextResponse.json(response);
  } catch (err) {
    console.error("analyse-ingredients engine error:", err);
    return NextResponse.json(
      { error: "analysis_failed", message: "We couldn't analyse those ingredients. Please try again." },
      { status: 422 },
    );
  }
}
