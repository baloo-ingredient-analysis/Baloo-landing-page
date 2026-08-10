import { describe, it, expect, afterEach } from "vitest";
import { productEmbeddingText, toVectorLiteral, embeddingsEnabled } from "./embeddings";

describe("toVectorLiteral", () => {
  it("formats a number array as a pgvector literal", () => {
    expect(toVectorLiteral([0.1, 0.2, 0.3])).toBe("[0.1,0.2,0.3]");
    expect(toVectorLiteral([])).toBe("[]");
  });
});

describe("productEmbeddingText", () => {
  it("joins brand, name, summary and ingredient names", () => {
    const text = productEmbeddingText({
      name: "Oat Drink Barista",
      brand: "Oatly",
      summary: "A simple oat drink for coffee.",
      ingredientNames: ["Water", "Oats", "Rapeseed oil"],
    });
    for (const part of ["Oatly", "Oat Drink Barista", "coffee", "Water", "Rapeseed oil"]) {
      expect(text).toContain(part);
    }
  });

  it("skips missing/empty parts (no stray separators from null brand/summary)", () => {
    const text = productEmbeddingText({ name: "Mystery Product", brand: null, summary: null });
    expect(text).toBe("Mystery Product");
  });

  it("caps the ingredient list at 30 names", () => {
    const many = Array.from({ length: 40 }, (_, i) => `ing${i}`);
    const text = productEmbeddingText({ name: "P", ingredientNames: many });
    expect(text).toContain("ing29");
    expect(text).not.toContain("ing30");
  });

  it("caps total length so a huge input can't blow the token budget", () => {
    const text = productEmbeddingText({ name: "x".repeat(20000) });
    expect(text.length).toBeLessThanOrEqual(8000);
  });
});

describe("embeddingsEnabled (optional-infra switch)", () => {
  const original = process.env.OPENAI_API_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = original;
  });

  it("is true only when OPENAI_API_KEY is set", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    expect(embeddingsEnabled()).toBe(true);
    delete process.env.OPENAI_API_KEY;
    expect(embeddingsEnabled()).toBe(false);
  });
});
