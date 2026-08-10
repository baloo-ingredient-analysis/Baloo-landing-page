import { describe, it, expect } from "vitest";
import { computeNutrition, pickHighlights, fallbackContextSentence } from "./nutrition";
import { getProfile } from "./profile";
import type { Nutrition } from "./schema";

const adult = getProfile("adult"); // kcal 2000, fat 70, satfat 20, carb 260, sugars 90, fibre 30, protein 50, salt 6

function nut(nutrients: Nutrition["nutrients"], serving_size: string | null = null): Nutrition {
  const per = nutrients.some((n) => n.per_serving !== null) ? "serving" : "100g";
  return { serving_size, per, nutrients };
}

describe("computeNutrition — the arithmetic (model never calculates)", () => {
  it("computes % of the reference daily intake", () => {
    const { rows } = computeNutrition(
      nut([{ name: "Fat", per_100g: "7", per_serving: null, unit: "g" }]),
      adult,
    );
    expect(rows[0].pct_100g).toBe(10); // 7 / 70 * 100
  });

  it("Sodium is compared as salt (× 2.5) but keeps its printed name + value", () => {
    const { rows } = computeNutrition(
      nut([{ name: "Sodium", per_100g: "0.6", per_serving: null, unit: "g" }]),
      adult,
    );
    // 0.6 g sodium → 1.5 g salt-equivalent → 1.5 / 6 * 100 = 25%
    expect(rows[0].pct_100g).toBe(25);
    expect(rows[0].name).toBe("Sodium"); // display untouched
    expect(rows[0].per_100g).toBe("0.6");
  });

  it("rounds integers at ≥1%, one decimal below 1% (small-but-real never shows 0)", () => {
    const big = computeNutrition(nut([{ name: "Fat", per_100g: "3.5", per_serving: null, unit: "g" }]), adult);
    expect(big.rows[0].pct_100g).toBe(5); // 5.0 → integer

    const small = computeNutrition(nut([{ name: "Fat", per_100g: "0.35", per_serving: null, unit: "g" }]), adult);
    expect(small.rows[0].pct_100g).toBe(0.5); // 0.5% → one decimal, not 0
  });

  it("parses label values tolerantly: <, comma decimal, whitespace; null for non-numeric", () => {
    const { rows } = computeNutrition(
      nut([
        { name: "Salt", per_100g: "<0.5", per_serving: null, unit: "g" }, // approx
        { name: "Energy", per_100g: " 200 ", per_serving: null, unit: "kcal" }, // whitespace
        { name: "Sugars", per_100g: "0,9", per_serving: null, unit: "g" }, // comma decimal
        { name: "Fibre", per_100g: "trace", per_serving: null, unit: "g" }, // non-numeric
      ]),
      adult,
    );
    expect(rows[0].approx).toBe(true);
    expect(rows[0].pct_100g).toBe(8); // 0.5 / 6 * 100 = 8.33 → 8
    expect(rows[1].pct_100g).toBe(10); // 200 / 2000
    expect(rows[2].pct_100g).toBe(1); // 0.9 / 90 * 100 = 1
    expect(rows[3].pct_100g).toBeNull(); // "trace" → no %
  });

  it("basis is 'serving' when any serving value exists, else '100g'", () => {
    expect(computeNutrition(nut([{ name: "Fat", per_100g: "7", per_serving: "3.5", unit: "g" }]), adult).basis).toBe(
      "serving",
    );
    expect(computeNutrition(nut([{ name: "Fat", per_100g: "7", per_serving: null, unit: "g" }]), adult).basis).toBe(
      "100g",
    );
  });

  it("unmappable nutrients still display, just without a %", () => {
    const { rows } = computeNutrition(
      nut([{ name: "Vitamin C", per_100g: "12", per_serving: null, unit: "mg" }]),
      adult,
    );
    expect(rows[0].pct_100g).toBeNull();
    expect(rows[0].name).toBe("Vitamin C");
    expect(rows[0].per_100g).toBe("12");
  });
});

describe("pickHighlights", () => {
  it("excludes Energy and returns the top-2 by % on the active basis", () => {
    const computation = {
      basis: "100g" as const,
      rows: [
        { name: "Energy", unit: "kcal", per_100g: "", per_serving: null, pct_100g: 50, pct_serving: null, approx: false },
        { name: "Fat", unit: "g", per_100g: "", per_serving: null, pct_100g: 30, pct_serving: null, approx: false },
        { name: "Salt", unit: "g", per_100g: "", per_serving: null, pct_100g: 40, pct_serving: null, approx: false },
        { name: "Protein", unit: "g", per_100g: "", per_serving: null, pct_100g: null, pct_serving: null, approx: false },
      ],
    };
    expect(pickHighlights(computation)).toEqual([
      { name: "Salt", pct: 40 },
      { name: "Fat", pct: 30 },
    ]);
  });
});

describe("fallbackContextSentence", () => {
  it("builds a neutral, non-verdict sentence and prefixes the first with 'about'", () => {
    const s = fallbackContextSentence({
      serving_size: "30 g",
      basis: "serving",
      profileLabel: "Adult (average)",
      highlights: [
        { name: "Salt", pct: 25 },
        { name: "Fat", pct: 10 },
      ],
    });
    expect(s).toContain("A 30 g serving provides");
    expect(s).toContain("about 25% of the reference daily salt");
    expect(s).toContain("and 10% of the reference daily fat");
    expect(s).toContain("not a verdict");
  });

  it("returns empty string when there are no highlights", () => {
    expect(
      fallbackContextSentence({ serving_size: null, basis: "100g", profileLabel: "Adult", highlights: [] }),
    ).toBe("");
  });
});
