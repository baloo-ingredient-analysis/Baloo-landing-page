import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { absoluteUrl, breadcrumbJsonLd, productJsonLd } from "./seo";

// siteUrl() reads env at call time, so pin it for deterministic URLs.
const ORIG = process.env.NEXT_PUBLIC_SITE_URL;
beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://baloo.example";
});
afterEach(() => {
  if (ORIG === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = ORIG;
});

describe("absoluteUrl", () => {
  it("joins a path onto the base, normalising the leading slash", () => {
    expect(absoluteUrl("/p/gazpacho")).toBe("https://baloo.example/p/gazpacho");
    expect(absoluteUrl("p/gazpacho")).toBe("https://baloo.example/p/gazpacho");
  });
});

describe("productJsonLd", () => {
  it("emits the honest Product entity with an absolute url", () => {
    const node = productJsonLd({
      name: "Gazpacho Tradicional",
      slug: "gazpacho-tradicional",
      brand: "Alvalle",
      imageUrl: "https://img.example/g.jpg",
      description: "A cold tomato soup.",
      category: "Soups",
    });
    expect(node).toMatchObject({
      "@type": "Product",
      name: "Gazpacho Tradicional",
      url: "https://baloo.example/p/gazpacho-tradicional",
      brand: { "@type": "Brand", name: "Alvalle" },
      image: "https://img.example/g.jpg",
    });
  });

  it("NEVER emits rating or offer (score-free guardrail)", () => {
    const node = productJsonLd({ name: "X", slug: "x" });
    expect(node).not.toHaveProperty("aggregateRating");
    expect(node).not.toHaveProperty("review");
    expect(node).not.toHaveProperty("offers");
  });

  it("omits optional fields when absent", () => {
    const node = productJsonLd({ name: "X", slug: "x", brand: null, description: null });
    expect(node).not.toHaveProperty("brand");
    expect(node).not.toHaveProperty("description");
    expect(node).not.toHaveProperty("image");
  });
});

describe("breadcrumbJsonLd", () => {
  it("numbers the trail from 1 with absolute item URLs", () => {
    const node = breadcrumbJsonLd([
      { name: "Baloo", path: "/" },
      { name: "Gazpacho", path: "/p/gazpacho" },
    ]) as { itemListElement: { position: number; name: string; item: string }[] };
    expect(node.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Baloo", item: "https://baloo.example/" },
      { "@type": "ListItem", position: 2, name: "Gazpacho", item: "https://baloo.example/p/gazpacho" },
    ]);
  });
});
