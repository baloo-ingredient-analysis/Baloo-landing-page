import { describe, it, expect } from "vitest";
import { buildHeroPrompt, heroReferenceUrls, type HeroInput } from "./prompt";

const product = (name: string, brand: string | null, packshotUrl: string) => ({ name, brand, packshotUrl });

describe("buildHeroPrompt", () => {
  it("names a single product and asks for a faithful, clutter-free scene", () => {
    const input: HeroInput = {
      kind: "product",
      ratio: "4:5",
      products: [product("Penne Rigate N°73", "Barilla", "https://img/barilla.jpg")],
    };
    const p = buildHeroPrompt(input);
    expect(p).toContain("Barilla Penne Rigate N°73");
    expect(p).toContain("single product");
    expect(p).toMatch(/no shelves|no clutter|no price tags/);
    expect(p).toContain("accurate and legible");
  });

  it("lists multiple products as a group (A, B and C)", () => {
    const input: HeroInput = {
      kind: "list",
      ratio: "4:5",
      products: [
        product("Coca-Cola Zero Sugar", "Coca-Cola", "https://img/coke.jpg"),
        product("The Original Oreo", "Oreo", "https://img/oreo.jpg"),
        product("Doritos Nacho Cheese", "Doritos", "https://img/doritos.jpg"),
      ],
    };
    const p = buildHeroPrompt(input);
    expect(p).toContain("arranged together as a neat group");
    expect(p).toContain("Coca-Cola Zero Sugar, Oreo The Original Oreo and Doritos Nacho Cheese");
  });

  it("does not repeat the brand when the name already starts with it", () => {
    const p = buildHeroPrompt({
      kind: "product",
      ratio: "1:1",
      products: [product("Nutella", "Nutella", "https://img/n.jpg")],
    });
    expect(p).toContain("single product: Nutella");
    expect(p).not.toContain("Nutella Nutella");
  });

  it("dedupes and caps reference packshots at four", () => {
    const urls = heroReferenceUrls({
      kind: "list",
      ratio: "4:5",
      products: [
        product("A", null, "https://img/1.jpg"),
        product("B", null, "https://img/1.jpg"), // dup
        product("C", null, "https://img/2.jpg"),
        product("D", null, "https://img/3.jpg"),
        product("E", null, "https://img/4.jpg"),
        product("F", null, "https://img/5.jpg"), // over cap
      ],
    });
    expect(urls).toEqual(["https://img/1.jpg", "https://img/2.jpg", "https://img/3.jpg", "https://img/4.jpg"]);
  });
});
