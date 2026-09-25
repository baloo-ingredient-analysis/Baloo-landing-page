// SEO builders (framework-agnostic): absolute URLs + schema.org JSON-LD. All URLs resolve through
// siteUrl() so the whole SEO layer moves together the day the domain is decided (see lib/config.ts).
//
// Score-free guardrail (PRODUCT.md): the Product node deliberately carries NO aggregateRating / review
// and NO Offer. Baloo has no ratings (by design) and no pricing in the beta, so faking those shopping
// signals would be both dishonest and off-brand. We emit the honest entity — what the product IS —
// and let the ingredient explanations on the page do the ranking work.

import { siteUrl } from "./config";

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function productJsonLd(input: {
  name: string;
  slug: string;
  brand?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  category?: string | null;
}): Record<string, unknown> {
  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    url: absoluteUrl(`/p/${input.slug}`),
  };
  if (input.brand) node.brand = { "@type": "Brand", name: input.brand };
  if (input.imageUrl) node.image = input.imageUrl;
  if (input.description) node.description = input.description;
  if (input.category) node.category = input.category;
  return node;
}

// A trail of { name, path } from the site root down to the current page. Earns the breadcrumb
// rich result and gives crawlers the hierarchy explicitly.
export function breadcrumbJsonLd(
  trail: { name: string; path: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      item: absoluteUrl(t.path),
    })),
  };
}
