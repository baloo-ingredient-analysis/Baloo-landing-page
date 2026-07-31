import { describe, it, expect } from "vitest";
import {
  looksLikeUrl,
  validateUrl,
  detectRetailer,
  isSupportedUrl,
  retailerRegion,
  countryToRegion,
} from "./retailers";

describe("looksLikeUrl (dual-intent search heuristic)", () => {
  it("accepts full URLs and bare domains", () => {
    expect(looksLikeUrl("https://ocado.com/products/1")).toBe(true);
    expect(looksLikeUrl("ocado.com/products/1")).toBe(true);
    expect(looksLikeUrl("example.com")).toBe(true);
  });
  it("rejects natural-language queries", () => {
    expect(looksLikeUrl("kids cereals without junk")).toBe(false);
    expect(looksLikeUrl("hello world")).toBe(false);
  });
});

describe("detectRetailer / isSupportedUrl", () => {
  it("recognises supported retailers (incl. subdomains)", () => {
    expect(detectRetailer("https://www.ocado.com/products/x")).toBe("Ocado");
    expect(detectRetailer("https://tesco.com/groceries/x")).toBe("Tesco");
    expect(detectRetailer("https://wholefoodsmarket.com/product/x")).toBe("Whole Foods");
    expect(isSupportedUrl("https://target.com/p/x")).toBe(true);
  });
  it("returns null / false for unsupported hosts and junk", () => {
    expect(detectRetailer("https://amazon.com/x")).toBeNull();
    expect(detectRetailer("not a url")).toBeNull();
    expect(isSupportedUrl("https://amazon.com/x")).toBe(false);
  });
});

describe("validateUrl", () => {
  it("rejects empties, non-URLs, wrong protocols, and unsupported retailers", () => {
    expect(validateUrl("").ok).toBe(false);
    expect(validateUrl("notaurl").ok).toBe(false);
    expect(validateUrl("ftp://ocado.com").ok).toBe(false);
    expect(validateUrl("https://amazon.com/x").ok).toBe(false);
  });
  it("accepts a real product link from a supported retailer", () => {
    expect(validateUrl("https://ocado.com/products/123")).toEqual({ ok: true });
  });
});

describe("retailerRegion / countryToRegion", () => {
  it("maps retailers to their market", () => {
    expect(retailerRegion("Ocado")).toBe("UK");
    expect(retailerRegion("Target")).toBe("US");
    expect(retailerRegion("Whole Foods")).toBe("US");
    expect(retailerRegion("Nope")).toBeNull();
    expect(retailerRegion(null)).toBeNull();
  });
  it("maps an ISO country to a Baloo region", () => {
    expect(countryToRegion("US")).toBe("US");
    expect(countryToRegion("gb")).toBe("UK");
    expect(countryToRegion("UK")).toBe("UK");
    expect(countryToRegion("FR")).toBeNull();
    expect(countryToRegion(null)).toBeNull();
  });
});
