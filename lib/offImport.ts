// Import an Open Food Facts product into the catalog (Order OFF2). This is what fills the catalog so
// search has something to find. OFF gives us a structured product (name, ordered ingredients,
// nutrition) so we SKIP scrape + extract and go straight to the analysis engine: run the same
// `analyseIngredients` the paste flow uses on OFF's ingredient list, then persist with `ingestAnalysis`
// (canonical_key = barcode). A product we already know (done) is reused, never re-analysed.
//
// Optional-infra: no DB or no ANTHROPIC_API_KEY -> a typed failure, never a throw. See docs/OFF_CATALOG.md.

import { getOffProductByBarcode, searchOffProducts, type OffProduct } from "./openfoodfacts";
import { analyseIngredients } from "./analysis/pipeline";
import { ingestAnalysis } from "./ingest";
import { canonicalKey } from "./canonical";
import { db, type Db } from "./db";
import { getProductBySlugOrKey } from "./db/queries/products";

// OFF is the data SOURCE, not a shop — we don't record it as a retailer offer (that would read as
// "buy at Open Food Facts"). Stores/"available at" are derived elsewhere (own-brand -> its store).
export type ImportResult =
  | { ok: true; slug: string; productId: string; reused: boolean }
  | { ok: false; reason: "not_found" | "no_ingredients" | "no_db" | "no_key" | "analyse_failed" };

/** Core: import an already-mapped OFF product. Short-circuits a known barcode; else analyse + persist. */
export async function importOffMapped(dbi: Db, off: OffProduct): Promise<ImportResult> {
  if (!off.ingredients.length) return { ok: false, reason: "no_ingredients" };

  const key = canonicalKey({ name: off.name, brand: off.brand, barcode: off.barcode });

  // Already in the catalog and analysed? Reuse it, never pay to analyse twice.
  const existing = await getProductBySlugOrKey(dbi, key);
  if (existing && existing.analysisStatus === "done") {
    return { ok: true, slug: existing.slug, productId: existing.id, reused: true };
  }

  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: "no_key" };

  let analysis;
  try {
    analysis = await analyseIngredients({
      product_name: off.name,
      retailer: "", // OFF has no retailer; ingest stores retailer as null (below)
      ingredients_list: off.ingredients.map((i) => i.name),
      percentages: off.ingredients
        .filter((i) => i.percent)
        .map((i) => ({ ingredient: i.name, percentage: i.percent! })),
    });
  } catch (err) {
    console.error("OFF analyse failed:", err);
    return { ok: false, reason: "analyse_failed" };
  }

  const persisted = await ingestAnalysis({
    product_name: off.name,
    brand: off.brand,
    barcode: off.barcode,
    retailer: null, // not a store-sourced product
    ingredients: analysis.ingredients,
    product_summary: analysis.product_summary ?? null,
    nutrition: off.nutrition ?? undefined,
  });
  if (!persisted) return { ok: false, reason: "analyse_failed" };

  return { ok: true, slug: persisted.slug, productId: persisted.productId, reused: false };
}

/** Import by barcode (the app's scan path, and known-identity lookups). */
export async function importOffByBarcode(barcode: string): Promise<ImportResult> {
  const dbi = db();
  if (!dbi) return { ok: false, reason: "no_db" };
  const off = await getOffProductByBarcode(barcode);
  if (!off) return { ok: false, reason: "not_found" };
  return importOffMapped(dbi, off);
}

/** Import the best name match (the web's search-miss path). */
export async function importOffByQuery(query: string): Promise<ImportResult> {
  const dbi = db();
  if (!dbi) return { ok: false, reason: "no_db" };
  const [best] = await searchOffProducts(query, 1);
  if (!best) return { ok: false, reason: "not_found" };
  return importOffMapped(dbi, best);
}
