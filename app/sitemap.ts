import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/config";
import { profilePath } from "@/lib/profilePath";
import { getProductSitemapEntries } from "@/lib/db/queries/products";
import { getPublicListSitemapEntries } from "@/lib/db/queries/lists";
import { getPublicProfileSitemapEntries } from "@/lib/db/queries/profiles";

// XML sitemap (SEO) — the map Google crawls to find our content: the static entry points plus every
// public product, list and profile. All URLs are absolute via siteUrl(), so the sitemap follows the
// domain the day it's decided (NEXT_PUBLIC_SITE_URL) with zero code change.
//
// Optional-infra: with no DATABASE_URL the DB client is null and we emit just the static routes —
// same degrade-to-no-op rule as the rest of the app.
//
// Regenerated at most hourly (ISR) so new products/lists enter the index without a redeploy, while
// the crawl doesn't hit Postgres on every request.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/discover`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
  ];

  const dbi = db();
  if (!dbi) return staticRoutes;

  const [products, lists, profiles] = await Promise.all([
    getProductSitemapEntries(dbi),
    getPublicListSitemapEntries(dbi),
    getPublicProfileSitemapEntries(dbi),
  ]);

  return [
    ...staticRoutes,
    ...products.map((p) => ({
      url: `${base}/p/${p.slug}`,
      lastModified: new Date(p.lastmod),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...lists.map((l) => ({
      url: `${base}/list/${l.slug}`,
      lastModified: new Date(l.lastmod),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...profiles.map((pr) => ({
      url: `${base}${profilePath(pr.handle)}`,
      lastModified: new Date(pr.lastmod),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
