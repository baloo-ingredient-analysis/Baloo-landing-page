import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/config";
import { profilePath } from "@/lib/profilePath";
import { i18nEnabled, localizePath } from "@/lib/i18n/config";
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

  // hreflang in the sitemap (Languages track): when i18n is on, every entry declares its en + es
  // variants via <xhtml:link rel="alternate">, so Google discovers both language URLs without a
  // second set of <url> rows. GATED: flag off → no `alternates`, identical to today's sitemap.
  const langs = (path: string): { alternates?: { languages: Record<string, string> } } =>
    i18nEnabled()
      ? { alternates: { languages: { en: `${base}${path}`, es: `${base}${localizePath(path, "es")}` } } }
      : {};

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1, ...langs("/") },
    { url: `${base}/discover`, lastModified: now, changeFrequency: "daily", priority: 0.8, ...langs("/discover") },
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
      ...langs(`/p/${p.slug}`),
    })),
    ...lists.map((l) => ({
      url: `${base}/list/${l.slug}`,
      lastModified: new Date(l.lastmod),
      changeFrequency: "weekly" as const,
      priority: 0.6,
      ...langs(`/list/${l.slug}`),
    })),
    ...profiles.map((pr) => ({
      url: `${base}${profilePath(pr.handle)}`,
      lastModified: new Date(pr.lastmod),
      changeFrequency: "weekly" as const,
      priority: 0.5,
      ...langs(profilePath(pr.handle)),
    })),
  ];
}
