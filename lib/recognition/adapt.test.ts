import { describe, it, expect } from "vitest";
import { adaptExplain, adaptNutrition, adaptPercent, adaptRole, adaptTag } from "./adapt";
import type { ExplainResponse } from "./types";

// A representative response (shaped like the real explain-ingredients output seen in stress testing).
const sample: ExplainResponse = {
  variant_id: "v1",
  display_name: "Hummus Classic 240 g",
  brand: "Hacendado",
  category: "Classic hummus",
  product_summary: "This hummus is made primarily from chickpeas, with sunflower oil and a preservative.",
  nutrition: {
    amount_basis: "100g",
    energy_kcal: 300,
    fat_g: 24,
    saturates_g: 2.5,
    carbohydrate_g: 12,
    sugars_g: 1,
    fibre_g: 5,
    protein_g: 7,
    salt_g: 1.1,
    daily_reference: { standard: "uk_adult_ri", context: "…", nutrients: [{ id: "energy", amount: 300, unit: "kcal", reference: 2000, percent: 15 }] },
  },
  ingredients: [
    { canonical_name: "garbanzos", localized_name: "chickpeas", rank: 1, percent: 59, percent_type: "stated", processing_tag: "natural", general_explanation: "Chickpeas are a legume.", product_context: "The base of this hummus.", significance_note: "The main ingredient.", role_tags: ["base"] },
    { canonical_name: "sunflower oil", rank: 2, percent: 16.17, percent_type: "estimated", processing_tag: "processed", general_explanation: "A refined oil.", product_context: "Adds fat and texture.", significance_note: null, role_tags: ["fat", "texture_agent"] },
    { canonical_name: "potassium sorbate", percent: null, processing_tag: "artificial", general_explanation: "A preservative.", product_context: "Extends shelf life.", role_tags: ["preservative"] },
  ],
};

describe("adaptExplain", () => {
  const a = adaptExplain(sample);

  it("carries the summary + source identity", () => {
    expect(a.product_summary).toContain("hummus");
    expect(a.source).toMatchObject({ variantId: "v1", displayName: "Hummus Classic 240 g", category: "Classic hummus" });
  });

  it("maps a stated ingredient's full field set, preferring localized_name", () => {
    expect(a.ingredients[0]).toEqual({
      name: "chickpeas", // localized_name wins over canonical "garbanzos"
      tag: "Natural",
      role: "Base",
      what_it_is: "Chickpeas are a legume.",
      why_its_here: "The base of this hummus.",
      percentage: "59%",
      percentage_note: "The main ingredient.",
    });
  });

  it("falls back to canonical_name when localized_name is absent", () => {
    // The 2nd sample ingredient has no localized_name.
    expect(a.ingredients[1].name).toBe("sunflower oil");
  });

  it("folds percent_note (e.g. the >100% caption) into the note", () => {
    const [out] = adaptExplain({
      ingredients: [
        { canonical_name: "pork", localized_name: "pork", percent: 136.7, percent_type: "stated", processing_tag: "processed", significance_note: "The main ingredient.", percent_note: "This can exceed 100% because weight is lost during processing." },
      ],
    }).ingredients;
    expect(out.percentage).toBe("136.7%");
    expect(out.percentage_note).toBe("The main ingredient. This can exceed 100% because weight is lost during processing.");
  });

  it("maps the nutrition panel into rows per 100g", () => {
    expect(a.nutrition?.per).toBe("100g");
    expect(a.nutrition?.nutrients).toHaveLength(8);
    expect(a.nutrition?.nutrients.find((n) => n.name === "Energy")).toEqual({ name: "Energy", unit: "kcal", per_100g: "300", per_serving: null });
    expect(a.nutrition?.nutrients.find((n) => n.name === "Salt")).toMatchObject({ per_100g: "1.1", unit: "g" });
  });
});

describe("adaptTag (pending 2-vs-3 decision)", () => {
  it("natural stays Natural", () => expect(adaptTag("natural")).toBe("Natural"));
  it("processed stays Processed", () => expect(adaptTag("processed")).toBe("Processed"));
  it("artificial folds into Processed for now", () => expect(adaptTag("artificial")).toBe("Processed"));
  it("unknown/empty defaults to Processed", () => expect(adaptTag(undefined)).toBe("Processed"));
});

describe("adaptPercent", () => {
  it("stated → N%", () => expect(adaptPercent({ canonical_name: "x", percent: 59, percent_type: "stated" })).toBe("59%"));
  it("estimated → ~N%", () => expect(adaptPercent({ canonical_name: "x", percent: 16.17, percent_type: "estimated" })).toBe("~16.17%"));
  it("null percent → null", () => expect(adaptPercent({ canonical_name: "x", percent: null })).toBeNull());
  it("missing percent → null", () => expect(adaptPercent({ canonical_name: "x" })).toBeNull());
});

describe("adaptRole", () => {
  it("single tag → title case", () => expect(adaptRole(["base"])).toBe("Base"));
  it("underscores become spaces, joined with /", () => expect(adaptRole(["fat", "texture_agent"])).toBe("Fat / Texture agent"));
  it("empty → empty string", () => expect(adaptRole([])).toBe(""));
  it("missing → empty string", () => expect(adaptRole(undefined)).toBe(""));
});

describe("adaptNutrition", () => {
  it("returns undefined with no panel", () => expect(adaptNutrition(null)).toBeUndefined());
  it("returns undefined when the panel has no recognised nutrients", () => expect(adaptNutrition({ amount_basis: "100g" })).toBeUndefined());
  it("uses the serving column when amount_basis is serving", () => {
    const n = adaptNutrition({ amount_basis: "serving", energy_kcal: 90 });
    expect(n?.per).toBe("serving");
    expect(n?.nutrients[0]).toEqual({ name: "Energy", unit: "kcal", per_100g: null, per_serving: "90" });
  });
});
