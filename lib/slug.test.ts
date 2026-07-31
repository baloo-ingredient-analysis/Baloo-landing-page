import { describe, it, expect } from "vitest";
import { slugifyTitle, listSlug } from "./slug";

describe("slugifyTitle", () => {
  it("hyphenates a normalised title", () => {
    expect(slugifyTitle("Best Breakfast Picks!")).toBe("best-breakfast-picks");
  });
  it("degrades to 'list' when nothing slug-able remains", () => {
    expect(slugifyTitle("   ")).toBe("list");
    expect(slugifyTitle("!!!")).toBe("list");
  });
});

describe("listSlug", () => {
  it("is the slugified title plus a 6-char random suffix", () => {
    expect(listSlug("Best Breakfast")).toMatch(/^best-breakfast-[a-z0-9]{6}$/);
  });
  it("produces a fresh suffix each call (so same-title lists don't collide)", () => {
    expect(listSlug("Best Breakfast")).not.toBe(listSlug("Best Breakfast"));
  });
});
