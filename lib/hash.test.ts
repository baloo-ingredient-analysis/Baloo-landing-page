import { describe, it, expect } from "vitest";
import { hashUrl } from "./hash";

describe("hashUrl", () => {
  it("returns a 32-char hex digest", () => {
    expect(hashUrl("https://ocado.com/products/123")).toMatch(/^[0-9a-f]{32}$/);
  });
  it("ignores query/hash and trailing slash, and is case-insensitive on host+path", () => {
    const canonical = hashUrl("https://ocado.com/products/123");
    expect(hashUrl("https://Ocado.com/products/123/?utm_source=x#frag")).toBe(canonical);
    expect(hashUrl("https://ocado.com/products/123/")).toBe(canonical);
  });
  it("distinguishes different products", () => {
    expect(hashUrl("https://ocado.com/products/1")).not.toBe(hashUrl("https://ocado.com/products/2"));
  });
  it("falls back to the raw string for a non-URL input", () => {
    expect(hashUrl("not a url")).toMatch(/^[0-9a-f]{32}$/);
  });
});
