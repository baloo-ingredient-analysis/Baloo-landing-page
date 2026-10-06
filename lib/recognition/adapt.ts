// Pure mapping: the recognition engine's explain-ingredients response → our own lib/schema shapes
// (Ingredient[] + Nutrition + the product_summary sentence). No I/O, no env — fully unit-testable. This
// is the single place the two models meet, so every field decision lives here with a comment.

import type { Ingredient, Nutrition, Nutrient } from "../schema";
import type { EngineIngredient, EngineNutrition, ExplainResponse } from "./types";

export type EngineAnalysis = {
  ingredients: Ingredient[];
  product_summary: string;
  nutrition?: Nutrition;
  source: { variantId: string; displayName?: string; category?: string };
};

// TAG — pending decision (2-vs-3, raised to Jitain/Kat). The engine classifies into three
// (natural/processed/artificial); our shipped pill is two. Today we fold `artificial` into Processed to
// match the current design. If we adopt the three tags, widen Ingredient.tag in lib/schema and change
// THIS function — it's the only place the fold happens.
export function adaptTag(tag?: string): Ingredient["tag"] {
  return tag === "natural" ? "Natural" : "Processed";
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
  return {
    name: i.localized_name || i.canonical_name,
    tag: adaptTag(i.processing_tag),
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
