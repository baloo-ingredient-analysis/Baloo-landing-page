// Pure mapping: the recognition engine's explain-ingredients response → our own lib/schema shapes
// (Ingredient[] + Nutrition + the product_summary sentence). No I/O, no env — fully unit-testable. This
// is the single place the two models meet, so every field decision lives here with a comment.

import type { Ingredient, Nutrition, Nutrient } from "../schema";
import { deriveTag } from "../schema";
import type { EngineIngredient, EngineNutrition, ExplainResponse } from "./types";

export type EngineAnalysis = {
  ingredients: Ingredient[];
  product_summary: string;
  nutrition?: Nutrition;
  source: { variantId: string; displayName?: string; category?: string };
};

// TAGS (team decision, 16 Oct 2026) — two INDEPENDENT axes. The engine now sends `origin_class`
// (natural/artificial/unknown) + `processed_class` (yes/no/unknown). We map them straight through.
// FALLBACK: records explained before the engine change send only the legacy single `processing_tag`
// (and new fields may arrive null) — derive the two axes from it so nothing reads blank:
//   natural → origin natural (processing unknown; the old field can't tell us) ·
//   processed → processed yes · artificial → origin artificial + processed yes.
const VALID_ORIGIN = new Set(["natural", "artificial", "unknown"]);
const VALID_PROCESSED = new Set(["yes", "no", "unknown"]);

export function adaptAxes(i: EngineIngredient): { origin: Ingredient["origin"]; processed: Ingredient["processed"] } {
  const pt = i.processing_tag;
  const origin =
    typeof i.origin_class === "string" && VALID_ORIGIN.has(i.origin_class)
      ? (i.origin_class as Ingredient["origin"])
      : pt === "artificial"
        ? "artificial"
        : pt === "natural"
          ? "natural"
          : "unknown";
  const processed =
    typeof i.processed_class === "string" && VALID_PROCESSED.has(i.processed_class)
      ? (i.processed_class as Ingredient["processed"])
      : pt === "processed" || pt === "artificial"
        ? "yes"
        : "unknown"; // legacy "natural" can't tell us; leave it unknown rather than guess "no"
  return { origin, processed };
}

// PERCENT — the engine sends a number + percent_type. A stated amount prints as "59%", an estimate as
// "~59%" (never let an estimate read as a printed pack figure). Null stays null.
export function adaptPercent(i: EngineIngredient): string | null {
  if (i.percent === undefined || i.percent === null) return null;
  const prefix = i.percent_type === "estimated" ? "~" : "";
  return `${prefix}${i.percent}%`;
}

// ROLE — the engine's role_tags array → our short functional label. "base" → "Base",
// ["base","thickener"] → "Base / Thickener". Empty → "" (the UI reads role defensively).
export function adaptRole(tags?: string[]): string {
  if (!tags || tags.length === 0) return "";
  return tags
    .map((t) => t.replace(/_/g, " ").trim())
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" / ");
}

function adaptIngredient(i: EngineIngredient): Ingredient {
  // NAME — prefer the locale display name (`localized_name`); it's null when the catalog identity is
  // already in the requested language (e.g. a Spanish product under locale:es), so fall back to it.
  // The deeper "stable canonical name across languages" is a separate engine roadmap item.
  const { origin, processed } = adaptAxes(i);
  return {
    name: i.localized_name || i.canonical_name,
    origin,
    processed,
    tag: deriveTag({ origin, processed }), // legacy single tag, for surfaces not yet on two chips
    role: adaptRole(i.role_tags),
    what_it_is: i.general_explanation ?? "",
    why_its_here: i.product_context ?? "",
    percentage: adaptPercent(i),
    // significance_note is the general "how meaningful is this amount" line; percent_note carries the
    // special cases (e.g. the >100% QUID caption). Show both when present.
    percentage_note: [i.significance_note, i.percent_note].filter(Boolean).join(" ") || null,
  };
}

// The engine's nutrition is a FLAT object (one field per nutrient); our Nutrition is a row array. Map the
// known fields in label order. Values arrive as numbers (not the exact printed string we'd capture from a
// label), so we stringify them — close enough for display, and noted as a known approximation.
const NUTRIENT_FIELDS: { key: keyof EngineNutrition; name: string; unit: string }[] = [
  { key: "energy_kcal", name: "Energy", unit: "kcal" },
  { key: "fat_g", name: "Fat", unit: "g" },
  { key: "saturates_g", name: "Saturates", unit: "g" },
  { key: "carbohydrate_g", name: "Carbohydrate", unit: "g" },
  { key: "sugars_g", name: "Sugars", unit: "g" },
  { key: "fibre_g", name: "Fibre", unit: "g" },
  { key: "protein_g", name: "Protein", unit: "g" },
  { key: "salt_g", name: "Salt", unit: "g" },
];

export function adaptNutrition(n?: EngineNutrition | null): Nutrition | undefined {
  if (!n) return undefined;
  // Our `per` enum is 100g|serving|both; the engine's 100ml maps to the per-100 column too.
  const per: Nutrition["per"] = n.amount_basis === "serving" ? "serving" : "100g";
  const nutrients: Nutrient[] = [];
  for (const f of NUTRIENT_FIELDS) {
    const v = n[f.key] as number | null | undefined;
    if (v === undefined || v === null) continue;
    const val = String(v);
    nutrients.push({
      name: f.name,
      unit: f.unit,
      per_100g: per === "100g" ? val : null,
      per_serving: per === "serving" ? val : null,
    });
  }
  if (nutrients.length === 0) return undefined; // no panel → the Nutrition tab stays empty
  return { serving_size: null, per, nutrients };
}

export function adaptExplain(r: ExplainResponse): EngineAnalysis {
  return {
    ingredients: (r.ingredients ?? []).map(adaptIngredient),
    product_summary: r.product_summary ?? "",
    nutrition: adaptNutrition(r.nutrition),
    source: { variantId: r.variant_id ?? "", displayName: r.display_name, category: r.category },
  };
}
