import { describe, it, expect } from "vitest";
import { retailerServes, retailerCountries, retailerRegion } from "./retailers";

describe("retailerServes (Order GR1 — two-tier country geography)", () => {
  it("home = based in that country (UK folded to GB)", () => {
    expect(retailerServes("Ocado", "GB")).toBe("home");
    expect(retailerServes("Ocado", "UK")).toBe("home"); // shim
    expect(retailerServes("Tesco", "GB")).toBe("home");
    expect(retailerServes("Whole Foods", "US")).toBe("home");
    expect(retailerServes("Target", "US")).toBe("home");
  });

  it("delivers = reachable by cross-border shipping only (Koro across the EU + UK)", () => {
    expect(retailerServes("Koro", "DE")).toBe("home");
    expect(retailerServes("Koro", "GB")).toBe("delivers");
    expect(retailerServes("Koro", "FR")).toBe("delivers");
    expect(retailerServes("Koro", "US")).toBe("none"); // not in the EU delivery reach
  });

  it("none for a wrong country, unknown retailer, or missing inputs", () => {
    expect(retailerServes("Ocado", "US")).toBe("none");
    expect(retailerServes("Nonesuch", "US")).toBe("none");
    expect(retailerServes(null, "US")).toBe("none");
    expect(retailerServes("Ocado", null)).toBe("none");
    expect(retailerServes("Ocado", "")).toBe("none");
  });

  it("is case-insensitive on the country code", () => {
    expect(retailerServes("Ocado", "gb")).toBe("home");
    expect(retailerServes("Koro", "fr")).toBe("delivers");
  });
});

describe("retailerCountries", () => {
  it("returns home markets, empty for unknowns", () => {
    expect(retailerCountries("Koro")).toEqual(["DE"]);
    expect(retailerCountries("Ocado")).toEqual(["GB"]);
    expect(retailerCountries("Nonesuch")).toEqual([]);
    expect(retailerCountries(null)).toEqual([]);
  });
});

describe("retailerRegion (legacy L7, now derived from countries)", () => {
  it("keeps the same US/UK answers for the pasteable retailers", () => {
    expect(retailerRegion("Ocado")).toBe("UK");
    expect(retailerRegion("Tesco")).toBe("UK");
    expect(retailerRegion("Target")).toBe("US");
    expect(retailerRegion("Whole Foods")).toBe("US");
    expect(retailerRegion("Kroger")).toBe("US");
  });

  it("is null for geo-only or unknown retailers (L7 ignores them)", () => {
    expect(retailerRegion("Koro")).toBeNull(); // DE-based, not US/UK
    expect(retailerRegion("Nonesuch")).toBeNull();
    expect(retailerRegion(null)).toBeNull();
  });
});
