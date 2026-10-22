// Turning a stored, canonical product back into the shape the client already renders (Order P2).
//
// The catalog holds analysis normalised across ingredient_profiles / ingredient_profile_items /
// ingredients (the shared what_it_is cache). The UI — the paste-flow result and the product page —
// speaks `Ingredient[]` / `CachedResult`. This is the one place that translation lives, so the
// identity short-circuit in /api/extract and the product page can't drift apart.

import type { ProductPageData } from "../db/queries/products";
import type { CachedResult, Ingredient } from "../schema";

/** Stored profile items → the Ingredient[] the UI renders. Label order is preserved by the query. */
export function storedIngredients(data: ProductPageData): Ingredient[] {
  return data.items.map((i) => ({
    name: i.name,
    tag: i.tag ?? undefined,
    origin: i.origin ?? undefined,
    processed: i.processed ?? undefined,
    role: i.role ?? undefined,
    what_it_is: i.whatItIs ?? "",
    why_its_here: i.whyItsHere ?? "",
    percentage: i.percent ?? null,
    percentage_note: i.percentageNote ?? null,
  })) as Ingredient[];
}

/** A stored product → the CachedResult the paste-flow client renders on an instant hit. */
export function storedAsCachedResult(data: ProductPageData, url: string): CachedResult {
  return {
    product_name: data.product.name,
    retailer: data.product.retailer ?? "",
    url,
    ingredients: storedIngredients(data),
    nutrition: data.nutrition
      ? {
          serving_size: data.nutrition.servingSize,
          per: data.nutrition.per,
          nutrients: data.nutrition.nutrients,
        }
      : undefined,
    product_summary: data.summary ?? undefined,
  };
}
