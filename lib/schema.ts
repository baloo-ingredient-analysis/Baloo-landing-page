import { z } from "zod";

// --- Nutrition panel (captured in call 1, consumed by the Nutrition tab / lib/nutrition.ts) ---
// Contract: values are strings copied EXACTLY as printed ("6.4", "<0.5") — number only, unit kept
// separately — so label fidelity is preserved; downstream code does all parsing and arithmetic.
export const nutrientSchema = z.object({
  name: z
    .string()
    .describe(
      'Canonical name: "Energy", "Fat", "Saturates", "Carbohydrate", "Sugars", "Fibre", ' +
        '"Protein", "Salt" (use "Sodium" only if that is what the label prints)',
    ),
  per_100g: z
    .string()
    .nullable()
    .describe('Value per 100g/100ml exactly as printed, number only (e.g. "6.4", "<0.5"); null if not shown'),
  per_serving: z
    .string()
    .nullable()
    .describe("Value per serving/portion exactly as printed, number only; null if not shown"),
  unit: z.string().describe('The unit as printed: "kcal", "g", "mg"'),
});
export type Nutrient = z.infer<typeof nutrientSchema>;

export const nutritionSchema = z.object({
  serving_size: z
    .string()
    .nullable()
    .describe('Serving size exactly as printed, e.g. "30 g (about 13 crisps)"; null if not stated'),
  per: z
    .enum(["100g", "serving", "both"])
    .describe('Which basis the label provides; "100g" as placeholder when there is no panel'),
  nutrients: z
    .array(nutrientSchema)
    .describe("Label row order preserved; EMPTY array when the page shows no nutrition panel"),
});
export type Nutrition = z.infer<typeof nutritionSchema>;

// --- "Explain this" (Order G8b): Baloo's in-thread AI answer, in the signature two-beat that
// ingredient cards use — "What it is." (the ingredient in general) then "In this product." (why
// it's here / where it sits on the label). Neutral reference, never opinion or a health claim. ---
export const explanationSchema = z.object({
  what_it_is: z
    .string()
    .describe("2-3 sentences on the ingredient/topic in general: what it is, where it comes from."),
  in_this_product: z
    .string()
    .describe("2-3 sentences on the concrete role it plays in THIS product, tied to the label."),
});
export type Explanation = z.infer<typeof explanationSchema>;

// --- Call 1: extraction from page markdown ---
export const extractionSchema = z.object({
  product_name: z.string().describe("The product's name as shown on the page"),
  retailer: z.string().describe("The retailer / supermarket name"),
  ingredients_raw: z
    .string()
    .describe("The full ingredient list exactly as written, original order preserved"),
  ingredients_list: z
    .array(z.string())
    .describe("The ingredients split into an ordered array, label order preserved"),
  percentages: z
    .array(
      z.object({
        ingredient: z.string(),
        percentage: z.string().describe('e.g. "1%"'),
      }),
    )
    .describe("Any percentages listed on the label; empty array if none"),
  nutrition: nutritionSchema,
});
export type Extraction = z.infer<typeof extractionSchema>;

// --- Call 2: per-ingredient analysis (streamed) ---
// TAGS — two INDEPENDENT axes (team decision, 16 Oct 2026), not one Natural/Processed boolean:
//   origin    = where it comes from  (natural ↔ artificial are the real opposites)
//   processed = what was done to it  (an ingredient can be natural AND processed — e.g. olive oil)
// This mirrors the engine's `origin_class` + `processed_class`. The legacy single `tag` is DERIVED
// (deriveTag) for the catalog/cache columns and for surfaces not yet upgraded to the two chips.
export const ingredientSchema = z.object({
  name: z.string(),
  origin: z
    .enum(["natural", "artificial", "unknown"])
    .describe(
      "Where the ingredient comes from. 'natural' = from a plant, animal, fungus, or mineral source, " +
        "INCLUDING things pressed, extracted, refined, or purified from such a source (sugar, olive oil, " +
        "citric acid). 'artificial' = synthetically manufactured and not found in nature in that form " +
        "(sucralose, aspartame, artificial colours such as Red 40 / Allura Red). 'unknown' only when the " +
        "source is genuinely unclear. This describes ORIGIN, independent of whether it was processed.",
    ),
  processed: z
    .enum(["yes", "no", "unknown"])
    .describe(
      "Whether the ingredient has been materially transformed. 'yes' = pressed, extracted, refined, " +
        "concentrated, isolated, hydrogenated, FERMENTED, or otherwise changed from its whole state " +
        "(rolled oats, refined oil, yoghurt, maltodextrin). 'no' = essentially whole and unchanged " +
        "(a whole oat grain, a whole date). Washing, cleaning, cutting, or sorting ALONE do NOT count. " +
        "'unknown' only when genuinely unclear. Independent of origin — a natural ingredient can be processed.",
    ),
  role: z
    .string()
    .describe(
      'A 2-4 word neutral functional label for what the ingredient does in THIS product, e.g. "Base", "Thickener / stabiliser", "Culture / ferment" — never a judgment',
    ),
  what_it_is: z.string().describe("Plain-language explanation of the ingredient itself"),
  why_its_here: z.string().describe("Why it is in this specific product"),
  percentage: z.string().nullable().describe('e.g. "1%", or null if not listed'),
  percentage_note: z
    .string()
    .nullable()
    .describe("Whether that amount is meaningful or mainly cosmetic; null if no percentage"),
});
// origin/processed are REQUIRED for generation but OPTIONAL on the type: stored/legacy ingredients
// (pre-two-axis) carry only the derived `tag`, and the UI reads all three defensively.
export type Ingredient = Omit<z.infer<typeof ingredientSchema>, "origin" | "processed"> & {
  origin?: "natural" | "artificial" | "unknown";
  processed?: "yes" | "no" | "unknown";
  /** Legacy single display tag, derived from origin+processed. Still stored in the catalog/cache. */
  tag?: "Natural" | "Processed";
};

// The single pill some surfaces still render, and the value persisted to the `tag` column. Prefer the
// two axes when present (origin=artificial OR processed=yes → "Processed"); fall back to a stored
// legacy tag; default "Natural". The ONLY place the two-axis → one-tag fold happens.
export function deriveTag(i: Pick<Ingredient, "origin" | "processed" | "tag">): "Natural" | "Processed" {
  if (i.origin || i.processed) {
    return i.origin === "artificial" || i.processed === "yes" ? "Processed" : "Natural";
  }
  return i.tag ?? "Natural";
}

export const analysisSchema = z.object({
  ingredients: z.array(ingredientSchema),
  // Declared AFTER ingredients on purpose: streamObject emits JSON in schema property order,
  // so the summary streams in only once every ingredient card is out — the read strip's
  // "summary arrives last" behaviour (design handoff F2) with no orchestration code.
  product_summary: z
    .string()
    .describe(
      "ONE calm, neutral sentence about the formulation as a whole — no advice, no verdict",
    ),
});
export type Analysis = z.infer<typeof analysisSchema>;

// Shape stored in the cache and returned on a cache hit.
// nutrition (pre-B1) and product_summary (pre-F1) are optional so older entries stay
// readable; old cached ingredients also lack `role` at runtime — the UI reads defensively.
export type CachedResult = {
  product_name: string;
  retailer: string;
  url: string;
  ingredients: Ingredient[];
  nutrition?: Nutrition;
  product_summary?: string;
};
