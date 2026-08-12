import { describe, it, expect } from "vitest";
import { computeAvailability, availabilityLabel, weightedAvailability } from "./region";
import { GEO_WEIGHTS } from "./config";

describe("computeAvailability", () => {
  it("is empty for an empty list", () => {
    expect(computeAvailability(new Map(), "US")).toEqual({ availableCount: 0, total: 0, pct: 0 });
  });
  it("counts a product available if ANY of its retailers serves the region", () => {
    const perProduct = new Map<string, string[]>([
      ["p1", ["Whole Foods"]], // US
      ["p2", ["Tesco"]], // UK
      ["p3", ["Ocado", "Target"]], // UK + US → Target serves US
    ]);
    const a = computeAvailability(perProduct, "US");
    expect(a.availableCount).toBe(2);
    expect(a.total).toBe(3);
    expect(a.pct).toBeCloseTo(2 / 3);
  });
  it("treats an unrecognised retailer as unavailable (never over-promises)", () => {
    expect(computeAvailability(new Map([["p", ["NoSuchStore"]]]), "US")).toMatchObject({
      availableCount: 0,
      total: 1,
      pct: 0,
    });
  });
});

describe("availabilityLabel", () => {
  it("returns null for an empty list", () => {
    expect(availabilityLabel({ availableCount: 0, total: 0, pct: 0 })).toBeNull();
  });
  it("bands the wording by percentage — neutral, no flags", () => {
    expect(availabilityLabel({ availableCount: 3, total: 3, pct: 1 })).toEqual({
      label: "Available where you shop",
      tone: "full",
    });
    expect(availabilityLabel({ availableCount: 7, total: 10, pct: 0.7 })?.tone).toBe("most");
    expect(availabilityLabel({ availableCount: 3, total: 10, pct: 0.3 })?.tone).toBe("some");
    expect(availabilityLabel({ availableCount: 0, total: 2, pct: 0 })).toEqual({
      label: "Not sold where you shop",
      tone: "none",
    });
  });
});

describe("weightedAvailability (Order GR2 — two-tier geo score)", () => {
  const wDel = GEO_WEIGHTS.wDel;

  it("is 0 for an empty list, an unknown country, or a missing country", () => {
    expect(weightedAvailability(new Map(), "GB")).toBe(0);
    expect(weightedAvailability(new Map([["p", ["Ocado"]]]), null)).toBe(0);
    expect(weightedAvailability(new Map([["p", ["Ocado"]]]), "")).toBe(0);
  });

  it("scores 1 when every product is sold in the user's country", () => {
    const perProduct = new Map<string, string[]>([
      ["p1", ["Ocado"]],
      ["p2", ["Tesco"]],
    ]);
    expect(weightedAvailability(perProduct, "GB")).toBe(1);
  });

  it("takes the BEST tier per product (home beats delivers beats none)", () => {
    // For a GB user: Ocado is home (1), Koro-only delivers (wDel), Target-only none (0).
    const perProduct = new Map<string, string[]>([
      ["p1", ["Ocado", "Koro"]], // home wins → 1
      ["p2", ["Koro"]], // delivers → wDel
      ["p3", ["Target"]], // US only → 0
    ]);
    expect(weightedAvailability(perProduct, "GB")).toBeCloseTo((1 + wDel + 0) / 3);
  });

  it("weights cross-border delivery below a based-here retailer", () => {
    const local = weightedAvailability(new Map([["p", ["Ocado"]]]), "GB");
    const shipped = weightedAvailability(new Map([["p", ["Koro"]]]), "GB");
    expect(local).toBe(1);
    expect(shipped).toBe(wDel);
    expect(shipped).toBeLessThan(local);
  });

  it("honours a custom delivery weight", () => {
    expect(weightedAvailability(new Map([["p", ["Koro"]]]), "GB", 0.5)).toBe(0.5);
  });
});
