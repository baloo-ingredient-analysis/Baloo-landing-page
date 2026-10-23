import { describe, it, expect } from "vitest";
import { finalize, planHero, type GradedProduct, type PackshotGrade } from "./packshotQuality";

const q = (grade: PackshotGrade, confidence = 0.9) => finalize(grade, confidence, "test");
const prod = (name: string, brand: string | null = null) => ({ name, brand });
const graded = <T>(product: T, quality: ReturnType<typeof q> | null): GradedProduct<T> => ({ product, quality });

describe("finalize", () => {
  it("only a confident studio_3d is usable for the hybrid scene", () => {
    expect(q("studio_3d", 0.9).usableForHybrid).toBe(true);
    expect(q("studio_3d", 0.3).usableForHybrid).toBe(false); // low confidence → fail safe
    expect(q("flat_scan", 0.95).usableForHybrid).toBe(false);
    expect(q("lifestyle", 0.95).usableForHybrid).toBe(false);
  });

  it("studio and flat scans are both faithful enough to show flat on a tint card", () => {
    expect(q("studio_3d").usableAsFlatPackshot).toBe(true);
    expect(q("flat_scan").usableAsFlatPackshot).toBe(true);
    expect(q("lifestyle").usableAsFlatPackshot).toBe(false);
    expect(q("unusable").usableAsFlatPackshot).toBe(false);
  });
});

describe("planHero (fallback ladder)", () => {
  it("1. composes only the clean 3D packshots, dropping flat/lifestyle ones", () => {
    const plan = planHero([
      graded(prod("Nutella", "Nutella"), q("studio_3d")),
      graded(prod("Actimel", "Actimel"), q("flat_scan")), // dropped from the scene
      graded(prod("Gazpacho", "Hacendado"), q("studio_3d")),
      graded(prod("Hummus", "Hacendado"), q("lifestyle")), // dropped
    ]);
    expect(plan.strategy).toBe("hybrid");
    expect(plan.verified).toBe(true);
    expect(plan.products.map((p) => p.name)).toEqual(["Nutella", "Gazpacho"]);
  });

  it("1b. a single clean packshot still yields a (one-product) hybrid", () => {
    const plan = planHero([
      graded(prod("Gazpacho", "Hacendado"), q("studio_3d")),
      graded(prod("Hummus", "Hacendado"), q("lifestyle")),
    ]);
    expect(plan.strategy).toBe("hybrid");
    expect(plan.products.map((p) => p.name)).toEqual(["Gazpacho"]);
  });

  it("2. total classifier outage falls back to an unverified hybrid (no regression)", () => {
    const plan = planHero([graded(prod("A", "A"), null), graded(prod("B", "B"), null)]);
    expect(plan.strategy).toBe("hybrid");
    expect(plan.verified).toBe(false);
    expect(plan.products.map((p) => p.name)).toEqual(["A", "B"]);
  });

  it("3. no clean 3D shot but a faithful flat scan → flat card with that one product", () => {
    const plan = planHero([
      graded(prod("Actimel", "Actimel"), q("flat_scan")),
      graded(prod("Hummus", "Hacendado"), q("lifestyle")),
    ]);
    expect(plan.strategy).toBe("flat");
    expect(plan.products.map((p) => p.name)).toEqual(["Actimel"]);
  });

  it("4. nothing usable → the brand card", () => {
    const plan = planHero([
      graded(prod("Hummus", "Hacendado"), q("lifestyle")),
      graded(prod("Blurry", "X"), q("unusable")),
    ]);
    expect(plan.strategy).toBe("brand");
    expect(plan.products).toEqual([]);
  });

  it("prefers graded studio shots over ungraded ones (partial outage stays verified)", () => {
    const plan = planHero([
      graded(prod("Known", "K"), q("studio_3d")),
      graded(prod("Ungraded", "U"), null),
    ]);
    expect(plan.strategy).toBe("hybrid");
    expect(plan.verified).toBe(true);
    expect(plan.products.map((p) => p.name)).toEqual(["Known"]);
  });

  it("caps the hybrid scene at max, deduping brands for variety", () => {
    const plan = planHero(
      [
        graded(prod("Coke Zero", "Coca-Cola"), q("studio_3d")),
        graded(prod("Coke Classic", "Coca-Cola"), q("studio_3d")),
        graded(prod("Oreo", "Oreo"), q("studio_3d")),
        graded(prod("Doritos", "Doritos"), q("studio_3d")),
        graded(prod("Lay's", "Lay's"), q("studio_3d")),
      ],
      3,
    );
    expect(plan.products.map((p) => p.brand)).toEqual(["Coca-Cola", "Oreo", "Doritos"]);
  });
});
