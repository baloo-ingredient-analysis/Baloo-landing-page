import type { Ingredient } from "./schema";

export const MOCK_EXTRACT = {
  cached: false,
  key: "mock",
  url: "https://www.ocado.com/products/oatly-oat-drink",
  product_name: "Oatly Oat Drink Whole",
  retailer: "Ocado",
  ingredients_raw: "Water, Oats 10%, Rapeseed Oil, Calcium Carbonate, Salt, Vitamins",
  ingredients_list: ["Water", "Oats", "Rapeseed Oil", "Calcium Carbonate", "Salt", "Vitamins (D2, Riboflavin, B12)"],
  percentages: [{ ingredient: "Oats", percentage: "10%" }],
  nutrition: {
    serving_size: "250 ml (a glass)",
    per: "both" as const,
    nutrients: [
      { name: "Energy", per_100g: "60", per_serving: "150", unit: "kcal" },
      { name: "Fat", per_100g: "3.0", per_serving: "7.5", unit: "g" },
      { name: "Saturates", per_100g: "0.3", per_serving: "0.8", unit: "g" },
      { name: "Carbohydrate", per_100g: "6.6", per_serving: "16.5", unit: "g" },
      { name: "Sugars", per_100g: "4.1", per_serving: "10.3", unit: "g" },
      { name: "Fibre", per_100g: "0.8", per_serving: "2.0", unit: "g" },
      { name: "Protein", per_100g: "1.0", per_serving: "2.5", unit: "g" },
      { name: "Salt", per_100g: "0.10", per_serving: "0.25", unit: "g" },
    ],
  },
};

const MOCK_INGREDIENTS: Ingredient[] = [
  { name: "Water", origin: "natural", processed: "no", role: "Base", what_it_is: "The liquid base of the drink.", why_its_here: "It's the carrier the oats are blended into, which is why it's listed first.", percentage: null, percentage_note: null },
  { name: "Oats", origin: "natural", processed: "yes", role: "Base", what_it_is: "A whole grain, here finely milled and enzyme-treated to release natural sweetness.", why_its_here: "The defining ingredient — it gives the drink its body and flavour.", percentage: "10%", percentage_note: "A meaningful amount for an oat drink; it's the second-largest ingredient by weight." },
  { name: "Rapeseed Oil", origin: "natural", processed: "yes", role: "Oil / fat", what_it_is: "A refined plant oil.", why_its_here: "A small amount adds a creamier mouthfeel and carries fat-soluble vitamins.", percentage: null, percentage_note: null },
  { name: "Calcium Carbonate", origin: "natural", processed: "yes", role: "Fortification", what_it_is: "A mineral source of calcium.", why_its_here: "Added to fortify the drink so it's closer to dairy milk's calcium level.", percentage: null, percentage_note: null },
  { name: "Salt", origin: "natural", processed: "no", role: "Flavour", what_it_is: "Sodium chloride.", why_its_here: "A pinch rounds out and balances the flavour.", percentage: null, percentage_note: null },
  { name: "Vitamins (D2, Riboflavin, B12)", origin: "artificial", processed: "yes", role: "Fortification", what_it_is: "Added micronutrients, usually produced by synthesis or fermentation rather than extracted from food.", why_its_here: "Fortification, again to match the nutritional profile people expect from milk.", percentage: null, percentage_note: null },
];

const MOCK_SUMMARY =
  "A short list built on water and oats, with a refined oil for texture and added minerals and vitamins doing fortification work.";

// Streams the JSON in small chunks so useObject's partial parser reveals cards one by one.
// product_summary sits after ingredients so it arrives last, matching the real stream.
export function mockAnalyzeStream(delayMs = 70, chunkSize = 36): Response {
  const full = JSON.stringify({ ingredients: MOCK_INGREDIENTS, product_summary: MOCK_SUMMARY });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (let i = 0; i < full.length; i += chunkSize) {
        controller.enqueue(encoder.encode(full.slice(i, i + chunkSize)));
        await new Promise((r) => setTimeout(r, delayMs));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}