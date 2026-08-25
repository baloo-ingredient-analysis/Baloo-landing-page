import { describe, it, expect } from "vitest";
import { normalizeName, canonicalKey, productSlug, ingredientKey, productDedupKey } from "./canonical";

describe("normalizeName", () => {
  it("lowercases, strips punctuation, and collapses whitespace", () => {
    expect(normalizeName("Coca-Cola Zero!")).toBe("coca cola zero");
    expect(normalizeName("  Extra   Spaces  ")).toBe("extra spaces");
  });
  it("strips accents (NFKD)", () => {
    expect(normalizeName("Café")).toBe("cafe");
    expect(normalizeName("Cocá Cola")).toBe("coca cola");
  });
  it("strips mid-word accents without splitting the word (the zéro bug)", () => {
    // é = e + U+0301; must become "zero", never "ze ro" (the combining mark must be dropped, not
    // turned into a space). Critical for Spanish/French product names.
    expect(normalizeName("Coca-cola zéro")).toBe("coca cola zero");
    expect(normalizeName("José")).toBe("jose");
    expect(normalizeName("azúcar")).toBe("azucar");
  });
  it("empty-ish input normalises to empty string", () => {
    expect(normalizeName("!!!")).toBe("");
  });
});

describe("canonicalKey", () => {
  it("uses the barcode when it has ≥8 digits, stripping non-digits", () => {
    expect(canonicalKey({ name: "Zero", barcode: "5000112637922" })).toBe("barcode:5000112637922");
    expect(canonicalKey({ name: "Zero", barcode: "5 000 112 637 922" })).toBe("barcode:5000112637922");
  });
  it("falls back to a normalised brand+name key when no usable barcode", () => {
    expect(canonicalKey({ name: "Cola", brand: "Coca-Cola" })).toBe("bn:coca cola cola");
    expect(canonicalKey({ name: "Oat Drink" })).toBe("bn:oat drink");
    expect(canonicalKey({ name: "X", barcode: "123" })).toBe("bn:x"); // too short → not a barcode
  });
  it("the same real product converges on the same key", () => {
    expect(canonicalKey({ name: "Oatly Barista", brand: "Oatly" })).toBe(
      canonicalKey({ name: "OATLY  Barista!", brand: "oatly" }),
    );
  });
});

describe("productSlug", () => {
  it("is a readable base + a 6-hex suffix, and is deterministic per key", () => {
    const a = productSlug("Oatly Barista", "bn:oatly barista");
    const b = productSlug("Oatly Barista", "bn:oatly barista");
    expect(a).toBe(b);
    expect(a).toMatch(/^oatly-barista-[0-9a-f]{6}$/);
  });
  it("different keys yield different suffixes", () => {
    expect(productSlug("Same Name", "key-a")).not.toBe(productSlug("Same Name", "key-b"));
  });
  it("degrades to 'product' when the name has no slug-able characters", () => {
    expect(productSlug("!!!", "some-key")).toMatch(/^product-[0-9a-f]{6}$/);
  });
});

describe("ingredientKey", () => {
  it("normalises so the same ingredient maps to one cache row", () => {
    expect(ingredientKey("Water")).toBe("water");
    expect(ingredientKey("Sea Salt")).toBe(ingredientKey("  sea   salt "));
  });
});

describe("productDedupKey (search-display dedup: collapse the same product, keep different ones)", () => {
  const key = (name: string, brand?: string | null) => productDedupKey({ name, brand });

  it("collapses size/format/case/accent variants of the SAME product", () => {
    const canonical = key("Coca Cola Zero", "Coca-Cola");
    for (const [n, b] of [
      ["Coca Cola Zero 1,5l", "Coca-Cola"],
      ["Coca Cola Zero - 330 ml", "Coca-Cola"],
      ["COCA COLA ZERO", "coca cola"],
      ["Coca-cola zéro", "Coca-Cola zero"], // accented + brand-field spelling drift
      ["Coca cola zero", "Coca cola zero"],
    ] as const) {
      expect(key(n, b)).toBe(canonical);
    }
  });

  it("folds ES/EN label words so the same product across languages collapses", () => {
    // "Coca-Cola zero azúcar" (ES) and "Coca Cola Zero Sugar" (EN) are one product.
    expect(key("Coca-Cola zero azúcar", "Coca-Cola")).toBe(key("Coca Cola Zero Sugar", "Coca-Cola"));
  });

  it("keeps genuinely different products separate (distinct names)", () => {
    const zero = key("Coca Cola Zero", "Coca-Cola");
    expect(key("Coca Cola Zero Sugar", "Coca-Cola")).not.toBe(zero); // different product line
    expect(key("Coca-Cola", "Coca-Cola")).not.toBe(zero); // regular ≠ zero
    expect(key("Nutella Biscuits", "Nutella")).not.toBe(key("Nutella", "Nutella")); // spread ≠ biscuits
  });

  it("collapses ONE product stored under different brand spellings (name-only key)", () => {
    // The same "Nutella" listed with brand Nutella / Ferrero / FerreroNutella is one product.
    const a = key("Nutella", "Nutella");
    expect(key("Nutella", "Ferrero")).toBe(a);
    expect(key("Nutella", "FerreroNutella")).toBe(a);
  });

  it("is order-independent (same word set, different order → same key)", () => {
    expect(key("Oat Drink Barista Edition")).toBe(key("Barista Edition Oat Drink"));
    // but a different word SET (a real flavour word) stays separate
    expect(key("Doritos BBQ")).not.toBe(key("Doritos Nacho"));
  });

  it("drops generic packaging/marketing filler but keeps distinctive words", () => {
    expect(key("Oat Drink Barista Edition Long Life")).toBe(key("Oat Drink Barista"));
    expect(key("Pringles Sabor Original")).toBe(key("Pringles Original")); // sabor→flavour→filler
    expect(key("Pringles Original")).not.toBe(key("Pringles")); // "original" is NOT filler
  });

  it("ignores the query's own tokens so the brand-in-name doesn't split a product", () => {
    const q = new Set(["oatly"]);
    expect(productDedupKey({ name: "Oatly Oat Drink Barista" }, q)).toBe(
      productDedupKey({ name: "Oat Drink Barista" }, q),
    );
  });
});
