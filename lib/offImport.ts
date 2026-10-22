// Import an Open Food Facts product into the catalog (Order OFF2). This is what fills the catalog so
// search has something to find. OFF gives us a structured product (name, ordered ingredients,
// nutrition) so we SKIP scrape + extract and go straight to the analysis engine: run the same
// `analyseIngredients` the paste flow uses on OFF's ingredient list, then persist with `ingestAnalysis`
// (canonical_key = barcode). A product we already know (done) is reused, never re-analysed.
//
// Optional-infra: no DB or no ANTHROPIC_API_KEY -> a typed failure, never a throw. See docs/OFF_CATALOG.md.

import { getOffProductByBarcode, searchOffCandidates, type OffProduct } from "./openfoodfacts";
import { analyseIngredients } from "./analysis/pipeline";
import { ingestAnalysis } from "./ingest";
import { canonicalKey } from "./canonical";
import { db, type Db } from "./db";
import { getProductBySlugOrKey } from "./db/queries/products";
import { analyseViaEngine, engineFirstEnabled } from "./recognition";

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

  // Engine-first (engine swap, Slice A): when it can resolve this barcode, Igor's shared engine is the
  // source of the intelligence (ingredients, the two axes, explanations). OFF stays for identity, sales
  // markets (countries) and the fallback. ANY miss falls through to the web's own Claude analysis below,
  // so the path never dead-ends. Inert unless ENGINE_FIRST=1.
  if (engineFirstEnabled() && off.barcode) {
    try {
      const eng = await analyseViaEngine({
        barcode: off.barcode,
        brand: off.brand ?? undefined,
        productName: off.name,
        locale: "en",
      });
      if (eng.ok && eng.analysis.ingredients.length) {
        const persisted = await ingestAnalysis({
          product_name: eng.analysis.source.displayName || off.name,
          brand: off.brand,
          barcode: off.barcode,
          retailer: null,
          ingredients: eng.analysis.ingredients,
          product_summary: eng.analysis.product_summary || null,
          nutrition: eng.analysis.nutrition ?? off.nutrition ?? undefined,
          countries: off.countries,
        });
        if (persisted) {
          return { ok: true, slug: persisted.slug, productId: persisted.productId, reused: false };
        }
      }
    } catch (err) {
      console.error("engine-first import failed (falling back to OFF + Claude):", err);
    }
    // fall through to the OFF + Claude path
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
    countries: off.countries, // OFF sales markets → the ES/UK gate in search
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

/** Import the best name match (the web's search-miss path): search for candidates and import the
 *  first that actually carries an ingredient list. The top hit often lacks ingredients (a photo-only
 *  OFF entry), so we walk the ranked candidates rather than giving up on the first. */
export async function importOffByQuery(query: string): Promise<ImportResult> {
  const dbi = db();
  if (!dbi) return { ok: false, reason: "no_db" };
  const candidates = await searchOffCandidates(query, 6);
  if (!candidates.length) return { ok: false, reason: "not_found" };

  let sawCandidate = false;
  for (const c of candidates) {
    const off = await getOffProductByBarcode(c.barcode);
    if (!off) continue;
    sawCandidate = true;
    if (off.ingredients.length) return importOffMapped(dbi, off); // first with ingredients wins
  }
  // Found products but none listed ingredients (vs. matched nothing at all).
  return { ok: false, reason: sawCandidate ? "no_ingredients" : "not_found" };
}
