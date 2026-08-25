import type { Extraction } from "./schema";

// --- Call 1: extract from Firecrawl markdown ---
export function extractionPrompt(markdown: string): string {
  return `You are reading a supermarket product page that has been converted to markdown.

Extract:
1. The product name
2. The retailer name
3. The complete ingredient list, exactly as written, preserving the original order
4. The ingredients split into an ordered array (same order as the label)
5. Any ingredient percentages if listed (e.g. "sugar 12%")
6. The nutrition facts panel, if the page shows one

Ingredients on food labels are listed most-to-least by quantity, by law — preserve that order
exactly. If the page has no ingredient list (a non-food item, a login wall, or a blocked page),
return empty strings and empty arrays rather than guessing.

For the nutrition panel:
- Copy every value EXACTLY as printed — number only in per_100g / per_serving (e.g. "6.4",
  "<0.5"), with the unit ("kcal", "g", "mg") in the unit field. Never invent, convert, or
  round a number. Use null for any column the label doesn't show.
- Use these canonical nutrient names: "Energy", "Fat", "Saturates", "Carbohydrate", "Sugars",
  "Fibre", "Protein", "Salt" — use "Sodium" only if the label prints sodium instead of salt.
  Keep the label's row order.
- For energy, when the label shows both kJ and kcal, use the kcal figure (one row, unit "kcal");
  if only kJ is printed, copy the kJ value with unit "kJ".
- serving_size: the serving/portion description exactly as printed (e.g. "30 g (about 13
  crisps)"); null if not stated. per: which basis the label provides ("100g", "serving", or
  "both").
- If there is no nutrition panel, return an empty nutrients array, serving_size null, and per
  "100g" — never make numbers up.

PAGE MARKDOWN:
"""
${markdown}
"""`;
}

// --- Call 2: analyse each ingredient ---
export function analysisPrompt(input: {
  product_name: string;
  retailer: string;
  ingredients_list: string[];
  percentages: { ingredient: string; percentage: string }[];
}): string {
  const pct =
    input.percentages.length > 0
      ? input.percentages.map((p) => `${p.ingredient}: ${p.percentage}`).join(", ")
      : "none listed";

  return `You are a knowledgeable, calm nutritionist.
Education before persuasion. Never alarmist.
Never tell the user what to buy or avoid.
Explain what ingredients are and why they are used.
Context over judgment.

Product: ${input.product_name}
Retailer: ${input.retailer}
Ingredients in label order: ${input.ingredients_list.join(", ")}
Percentages where known: ${pct}

For each ingredient, in the same order, return:
- name: the ingredient's common English name. The source list may be in another language (e.g.
  Dutch, French, Spanish) — translate each name to plain English (e.g. "Suiker" → "Sugar",
  "Huile de tournesol" → "Sunflower oil"). Keep the label ORDER exactly; never reorder or drop any.
- tag: "Natural" or "Processed"
- role: a 2-4 word functional label for what it does in THIS product. Prefer one of: Base,
  Sweetener, Thickener / stabiliser, Emulsifier, Preservative, Colour, Flavour,
  Culture / ferment, Fortification, Oil / fat, Raising agent — but use another concise label
  when none fits. Purely functional and neutral: never a judgment, never a warning.
- what_it_is: 2-3 informative sentences explaining the ingredient itself, written to hold true of
  this ingredient in general (not just in this product, so the explanation is reusable): its
  origin/source, what it is made from or how it is produced, and the form it usually takes. Be
  specific and genuinely educational, not generic.
- why_its_here: 2-3 sentences on the concrete role it plays in THIS product — the function it
  serves (e.g. texture, moisture, preservation, flavour, colour, emulsifying, fortification) and
  why a product like this one includes it. Tie it to this product, not to ingredients in general.
  COMPOSITE BASE: when the label names the Base as a single made food that could itself be broken
  into sub-ingredients but the label does NOT break it down (e.g. "Greek Style Natural Yoghurt
  (Milk)", "Sponge", "Pastry", "Chocolate"), say so plainly here — note that the label lists it as
  the base without a further breakdown, and briefly what such a base is usually made of. This keeps
  a Processed base from reading as a mystery. State it as neutral context, never as a shortcoming.
- percentage: the listed percentage (e.g. "1%") or null
- percentage_note: if a percentage is present, whether that amount is meaningful or mainly
  cosmetic; otherwise null

After all the ingredients, return product_summary: ONE calm, neutral sentence about the
formulation as a whole (e.g. "Built mostly on recognisable kitchen ingredients, with two
additives doing texture work."). Factual and descriptive only — no advice, no verdict, no
"good/bad", no score-like language.

Explain and give context in the calm nutritionist voice above — never judge, never call an
ingredient good or bad, and never tell the user what to buy or avoid. Keep the ingredients in
label order. Do not reorder them.`;
}

// --- Nutrition context line (Order B3): Claude writes the words, code supplies the numbers ---
export function nutritionContextPrompt(input: {
  product_name: string;
  serving_size: string | null;
  basis: "serving" | "100g";
  profileLabel: string;
  highlights: { name: string; pct: number }[];
}): string {
  const portion =
    input.basis === "serving"
      ? `one serving (${input.serving_size ?? "serving size not stated"})`
      : "each 100 g / 100 ml (no serving size is stated)";
  const facts = input.highlights
    .map((h) => `${h.name}: ${h.pct}% of the reference daily intake`)
    .join("; ");

  return `You are a knowledgeable, calm nutritionist.
Education before persuasion. Never alarmist.
Never tell the user what to buy or avoid.
Explain what things are and why they are used.
Context over judgment.

Product: ${input.product_name}
Portion basis: ${portion}
Reference profile: ${input.profileLabel}
Pre-computed facts (already calculated in code — the ONLY numbers you may use): ${facts}

Write ONE short sentence of neutral context from these facts, in the voice above. You may add a
brief closing clause in the spirit of "a sense of how a portion adds up, not a verdict."

Rules:
- Use ONLY the numbers given. Never calculate, convert, extrapolate, or invent any number.
- Phrase as factual context ("about X% of the reference daily fat for ...").
- Never a judgment: no "too much", "high", "bad", "unhealthy", "watch out".
- Never advice: nothing about limiting, avoiding, choosing, or moderating.
- Plain text only, no markdown.`;
}

// --- "Explain this" (Order G8b): the in-thread AI answer. Grounded in the label-derived
// ingredient facts Baloo already stored; the model only explains what's there, never invents. ---
export function explainPrompt(input: {
  product_name: string;
  comment: string | null; // null = product-scope ("Explain the ingredients")
  ingredients: { name: string; tag: string | null; what_it_is: string; why_its_here: string }[];
}): string {
  const label = input.ingredients
    .map(
      (i) =>
        `- ${i.name}${i.tag ? ` (${i.tag})` : ""}: ${i.what_it_is || "—"}${
          i.why_its_here ? ` | in this product: ${i.why_its_here}` : ""
        }`,
    )
    .join("\n");

  const focus = input.comment
    ? `A community member wrote this comment on the product's discussion:\n"${input.comment}"\n\nExplain, factually, whatever ingredient or claim the comment touches — the most relevant thing on the label. If the comment is vague, explain the ingredient most likely being referred to.`
    : `No specific question was asked. Give a brief factual overview of what stands out on this product's ingredient label.`;

  return `You are a knowledgeable, calm nutritionist.
Education before persuasion. Never alarmist.
Never tell the user what to buy or avoid.
Explain what ingredients are and why they are used.
Context over judgment.

Product: ${input.product_name}
Ingredient facts already established from the label (your ONLY source of truth):
${label}

${focus}

Return two beats:
- what_it_is: 2-3 sentences on the ingredient/topic in general — true of it anywhere, not just here.
- in_this_product: 2-3 sentences on the concrete role it plays in THIS product, tied to the label.

Rules:
- Ground everything in the ingredient facts above. Never invent an ingredient or a number.
- This is a FACTUAL explanation, not an opinion and not a health claim. Do not agree or disagree
  with the comment, and never say an ingredient is good, bad, safe, unsafe, or something to avoid.
- Calm and neutral, in the voice above. Plain text, no markdown.`;
}
