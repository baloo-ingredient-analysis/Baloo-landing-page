// Shared "analyse + cache" core for the v1 API (mobile integration). Both /api/v1/analyse-ingredients
// and /api/v1/find-product produce the SAME response shape and the SAME cache semantics, so that
// lives here once, not copied per route.
//
// The route owns: auth, rate limit, ANTHROPIC_API_KEY guard, try/catch → 422, and scheduling the
// persist with after(). This helper owns: canonical key → cache read → (on miss) run the shared
// engine → build the response + the persist payload.

import { analyseIngredients } from "./analysis/pipeline";
import { storedIngredients } from "./analysis/stored";
import { canonicalKey } from "./canonical";
import { db } from "./db";
import { getProductBySlugOrKey, getProductForPage } from "./db/queries/products";
import type { IngestInput } from "./ingest";
import type { Ingredient, Nutrition } from "./schema";

export type AnalyseAndCacheInput = {
  name: string;
  brand?: string | null;
  barcode?: string | null;
  retailer?: string | null;
  url?: string | null;
  ingredients_list: string[];
  percentages: { ingredient: string; percentage: string }[];
  nutrition?: Nutrition | null;
};

export type AnalyseResponse = {
  product_name: string;
  product_summary: string | null;
  ingredients: Ingredient[];
  nutrition: Nutrition | null;
  cache: "hit" | "miss";
  canonical_key: string;
};

// Returns the response plus, on a miss, the payload the route should persist in after(). On a hit
// `persist` is null (already in the catalog). Throws only if the analysis engine itself fails —
// the route maps that to 422. Assumes ANTHROPIC_API_KEY is present (route guards it).
export async function analyseAndCache(
  input: AnalyseAndCacheInput,
): Promise<{ response: AnalyseResponse; persist: IngestInput | null }> {
  const key = canonicalKey({ name: input.name, brand: input.brand, barcode: input.barcode });

  // Cache: a product Baloo already analysed returns from the catalog with no model spend.
  const dbi = db();
  if (dbi) {
    try {
      const known = await getProductBySlugOrKey(dbi, key);
      if (known && known.analysisStatus === "done") {
        const data = await getProductForPage(dbi, known.slug);
        if (data && data.items.length) {
          return {
            response: {
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
            },
            persist: null,
          };
        }
      }
    } catch (err) {
      // Best-effort accelerator — a read error falls through to a fresh analysis, never fails.
      console.error("analyseAndCache cache read error (ignored):", err);
    }
  }

  // Miss: run the shared engine (same prompt + schema as the web paste flow).
  const analysis = await analyseIngredients({
    product_name: input.name,
    retailer: input.retailer ?? "",
    ingredients_list: input.ingredients_list,
    percentages: input.percentages,
  });

  const nutrition = input.nutrition ?? null;
  return {
    response: {
      product_name: input.name,
      product_summary: analysis.product_summary ?? null,
      ingredients: analysis.ingredients,
      nutrition,
      cache: "miss",
      canonical_key: key,
    },
    persist: {
      product_name: input.name,
      brand: input.brand,
      barcode: input.barcode,
      retailer: input.retailer ?? null,
      url: input.url ?? null,
      ingredients: analysis.ingredients,
      product_summary: analysis.product_summary ?? null,
      nutrition,
    },
  };
}
