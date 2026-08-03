import { NextResponse, after } from "next/server";
import { requireApiKey } from "@/lib/apiAuth";
import { checkLimit, tooMany } from "@/lib/ratelimit";
import { analyseIngredients } from "@/lib/analysis/pipeline";
import { ingestAnalysis } from "@/lib/ingest";
import { storedIngredients } from "@/lib/analysis/stored";
import { canonicalKey } from "@/lib/canonical";
import { db } from "@/lib/db";
import { getProductBySlugOrKey, getProductForPage } from "@/lib/db/queries/products";
import type { Ingredient, Nutrition } from "@/lib/schema";

// POST /api/v1/analyse-ingredients — the "brain" (mobile integration, see docs/API_CONTRACT_V1.md).
//
// Mobile already has an ingredient list (from Open Food Facts / Vision). This runs Baloo's shared
// analysis engine (analyseIngredients — one prompt + schema, identical to the web) and returns the
// per-ingredient breakdown. A product Baloo already knows (deduped on canonical_key) returns from
// the catalog with NO model spend; a miss is analysed and persisted in after() so the next call
// hits. Everything additive; the paste-flow routes are untouched.
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

  const brand = body.product?.brand?.trim() || null;
  const barcode = body.product?.barcode?.trim() || null;
  const retailer = body.product?.retailer?.trim() || "";
  const percentages = Array.isArray(body.percentages) ? body.percentages : [];
  const key = canonicalKey({ name, brand, barcode });

  // --- Cache: a product Baloo already analysed returns from the catalog, no model spend. ---
  const dbi = db();
  if (dbi) {
    try {
      const known = await getProductBySlugOrKey(dbi, key);
      if (known && known.analysisStatus === "done") {
        const data = await getProductForPage(dbi, known.slug);
        if (data && data.items.length) {
          return NextResponse.json({
            product_name: data.product.name,
            product_summary: data.summary ?? null,
            ingredients: storedIngredients(data),
            nutrition: data.nutrition
              ? {
                  serving_size: data.nutrition.servingSize,
                  per: data.nutrition.per,
                  nutrients: data.nutrition.nutrients,
                }
              : null,
            cache: "hit",
            canonical_key: key,
          });
        }
      }
    } catch (err) {
      // Cache is a best-effort accelerator — never fail the request over a read error; fall through
      // to a fresh analysis.
      console.error("analyse-ingredients cache read error (ignored):", err);
    }
  }

  // --- Miss: run the shared analysis engine. Requires Claude. ---
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "upstream_unavailable", message: "Analysis is temporarily unavailable." },
      { status: 503 },
    );
  }

  let analysis;
  try {
    analysis = await analyseIngredients({
      product_name: name,
      retailer,
      ingredients_list: ingredients,
      percentages,
    });
  } catch (err) {
    console.error("analyse-ingredients engine error:", err);
    return NextResponse.json(
      { error: "analysis_failed", message: "We couldn't analyse those ingredients. Please try again." },
      { status: 422 },
    );
  }

  const analysed: Ingredient[] = analysis.ingredients;
  const nutrition = body.nutrition ?? null;

  // Persist to the catalog AFTER responding — non-blocking, and a no-op without a DB (optional-infra
  // rule). Keyed by brand/barcode so the next call for this product is a cache hit.
  after(async () => {
    await ingestAnalysis({
      product_name: name,
      brand,
      barcode,
      retailer: retailer || null,
      ingredients: analysed,
      product_summary: analysis.product_summary ?? null,
      nutrition,
    });
  });

  return NextResponse.json({
    product_name: name,
    product_summary: analysis.product_summary ?? null,
    ingredients: analysed,
    nutrition,
    cache: "miss",
    canonical_key: key,
  });
}
