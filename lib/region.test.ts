import { describe, it, expect } from "vitest";
import { computeAvailability, availabilityLabel } from "./region";

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
