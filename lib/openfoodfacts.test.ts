import { describe, it, expect } from "vitest";
import { mapOffProduct, mapOffNutrition, parseOffIngredients } from "./openfoodfacts";

// A trimmed but realistic Open Food Facts product payload (shape mirrors the real /api/v2 response).
const nutella = {
  code: "3017620422003",
  product_name: "Nutella",
  brands: "Nutella,Ferrero",
  quantity: "400 g",
  lang: "en",
  ingredients_text: "Sugar, palm oil, hazelnuts 13%, skimmed milk powder 8.7%, fat-reduced cocoa 7.4%",
  ingredients: [
    { text: "Sugar", percent_estimate: 42 },
    { text: "Palm oil", percent_estimate: 30 },
    { text: "Hazelnuts", percent: 13 },
    { text: "Skimmed milk powder", percent: "8.7" },
    { text: "Fat-reduced cocoa", percent: 7.4 },
  ],
  nutriments: {
    "energy-kcal_100g": 539,
    "energy-kcal_serving": 81,
    fat_100g: 30.9,
    "saturated-fat_100g": 10.6,
    carbohydrates_100g: 57.5,
    sugars_100g: 56.3,
    fiber_100g: 0,
    proteins_100g: 6.3,
    salt_100g: 0.107,
  },
  serving_size: "15 g",
  image_front_url: "https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.jpg",
  stores_tags: ["carrefour", "tesco"],
  countries_tags: ["en:france", "en:united-kingdom"],
};

describe("parseOffIngredients", () => {
  it("keeps label order and uses the DECLARED percent (not the estimate)", () => {
    const ing = parseOffIngredients(nutella, "en");
    expect(ing.map((i) => i.name)).toEqual([
      "Sugar", "Palm oil", "Hazelnuts", "Skimmed milk powder", "Fat-reduced cocoa",
    ]);
    expect(ing[0].percent).toBeNull(); // Sugar only had percent_estimate → not used
    expect(ing[2].percent).toBe("13%"); // declared
    expect(ing[3].percent).toBe("8.7%");
    expect(ing[4].percent).toBe("7.4%");
  });

  it("falls back to splitting ingredients_text for a native English product without a structured array", () => {
    const ing = parseOffIngredients({ ingredients_text: "Water, Sugar, Salt (sea salt)" }, "en");
    expect(ing.map((i) => i.name)).toEqual(["Water", "Sugar", "Salt"]);
    expect(ing.every((i) => i.percent === null)).toBe(true);
  });

  it("returns [] when there's nothing", () => {
    expect(parseOffIngredients({})).toEqual([]);
  });

  it("prefers the English text for a foreign-language product and parses inline percentages", () => {
    const frProduct = {
      ingredients: [
        { text: "Sucre", percent_estimate: 42 },
        { text: "NOISETTES", percent: 13 },
      ],
      ingredients_text: "Sucre, NOISETTES 13%",
      ingredients_text_en: "Sugar, hazelnuts 13%, skimmed milk powder 8.7%",
    };
    const ing = parseOffIngredients(frProduct, "fr"); // lang !== en → use English text
    expect(ing.map((i) => i.name)).toEqual(["Sugar", "hazelnuts", "skimmed milk powder"]);
    expect(ing[1].percent).toBe("13%");
    expect(ing[2].percent).toBe("8.7%");
  });

  it("uses the structured array (keeping exact percents) for an English product", () => {
    const enProduct = {
      ingredients: [{ text: "Oats", percent: 61 }, { text: "Water" }],
      ingredients_text_en: "Oats 61%, Water",
    };
    const ing = parseOffIngredients(enProduct, "en"); // lang en → structured
    expect(ing).toEqual([{ name: "Oats", percent: "61%" }, { name: "Water", percent: null }]);
  });

  it("accepts native Spanish products", () => {
    const es = { ingredients: [{ text: "Azúcar", percent: 20 }, { text: "Agua" }] };
    expect(parseOffIngredients(es, "es")).toEqual([
      { name: "Azúcar", percent: "20%" },
      { name: "Agua", percent: null },
    ]);
  });

  it("REJECTS a product with no English/Spanish ingredient text (no i18n yet)", () => {
    const greek = {
      lang: "el",
      ingredients: [{ text: "Ζάχαρη" }, { text: "Νερό" }],
      ingredients_text: "Ζάχαρη, Νερό",
    };
    expect(parseOffIngredients(greek, "el")).toEqual([]); // not en/es, no en/es text → skipped
  });
});

describe("mapOffNutrition", () => {
  it("maps OFF nutriments to canonical names, values as printed, per='both' when a serving exists", () => {
    const n = mapOffNutrition(nutella)!;
    expect(n.serving_size).toBe("15 g");
    expect(n.per).toBe("both"); // energy-kcal_serving present
    const energy = n.nutrients.find((x) => x.name === "Energy")!;
    expect(energy).toMatchObject({ per_100g: "539", per_serving: "81", unit: "kcal" });
    expect(n.nutrients.find((x) => x.name === "Salt")).toMatchObject({ per_100g: "0.107", unit: "g" });
    // fiber 0 is a real value, not missing
    expect(n.nutrients.find((x) => x.name === "Fibre")?.per_100g).toBe("0");
  });

  it("is '100g' when there are no per-serving values, and null when no nutriments", () => {
    const only100 = mapOffNutrition({ nutriments: { fat_100g: 5 } })!;
    expect(only100.per).toBe("100g");
    expect(mapOffNutrition({})).toBeNull();
    expect(mapOffNutrition({ nutriments: {} })).toBeNull();
  });
});

describe("mapOffProduct", () => {
  it("normalises a full product into our internal shape", () => {
    const p = mapOffProduct(nutella)!;
    expect(p.barcode).toBe("3017620422003");
    expect(p.name).toBe("Nutella");
    expect(p.brand).toBe("Nutella"); // first of the CSV
    expect(p.quantity).toBe("400 g");
    expect(p.ingredients.length).toBe(5);
    expect(p.nutrition?.nutrients.length).toBeGreaterThan(0);
    expect(p.imageUrl).toContain("openfoodfacts.org");
    expect(p.stores).toEqual(["carrefour", "tesco"]);
    expect(p.countries).toEqual(["france", "united kingdom"]); // lang prefix stripped, dashes humanised
  });

  it("prefers the English name, and strips non-digits from the barcode", () => {
    const p = mapOffProduct({ code: "  501-2345 ", product_name: "Producto", product_name_en: "Product" })!;
    expect(p.name).toBe("Product");
    expect(p.barcode).toBe("5012345");
  });

  it("returns null without a usable name (a nameless barcode isn't worth a row)", () => {
    expect(mapOffProduct({ code: "123" })).toBeNull();
  });
});
