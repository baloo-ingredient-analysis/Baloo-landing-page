import { describe, it, expect } from "vitest";
import { normalizeName, canonicalKey, productSlug, ingredientKey } from "./canonical";

describe("normalizeName", () => {
  it("lowercases, strips punctuation, and collapses whitespace", () => {
    expect(normalizeName("Coca-Cola Zero!")).toBe("coca cola zero");
    expect(normalizeName("  Extra   Spaces  ")).toBe("extra spaces");
  });
  it("strips accents (NFKD)", () => {
    expect(normalizeName("Café")).toBe("cafe");
    expect(normalizeName("Cocá Cola")).toBe("coca cola");
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
