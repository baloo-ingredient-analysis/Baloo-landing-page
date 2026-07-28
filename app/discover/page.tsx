import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { getExploreLists, withRegionAvailability } from "@/lib/db/queries/lists";
import { getRecentProducts } from "@/lib/db/queries/products";
import { getFollowingIds } from "@/lib/db/queries/follows";
import { getSessionUser } from "@/lib/auth";
import { REGIONS, countryToRegion, type Region } from "@/lib/retailers";
import { SiteHeader } from "@/components/SiteHeader";
import { ListCard } from "@/components/lists/ListCard";
import { ProductRow } from "@/components/ProductRow";
import { SearchBox } from "@/components/discover/SearchBox";

export const metadata: Metadata = {
  title: "Discover — Baloo",
  description: "Find lists and products the Baloo community is putting together.",
};

// Explore (Order L9). Discover is now the EXPLORE surface: ranked public lists from people you
// don't already follow (your Following surface is /feed). Ranking blends likes + saves + recency,
// then a regional soft-rank (L7). Category landings arrive with H1's taxonomy; until then the
// SearchBox is the finder.
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>;
}) {
  const dbi = db();

  // Exclude what already lives in Following (/feed): your own lists + everyone you follow. Signed
  // out → no exclusions (rank everyone).
  const viewer = dbi ? await getSessionUser() : null;
  const excludeOwnerIds =
    dbi && viewer ? [viewer.id, ...(await getFollowingIds(dbi, viewer.id))] : [];

  const [lists, products] = dbi
    ? await Promise.all([
        getExploreLists(dbi, { limit: 24, excludeOwnerIds }),
        getRecentProducts(dbi, 8),
      ])
    : [[], []];

  // Viewer region (Order L7): an explicit ?region wins, else Vercel geo, else US. Country-level
  // only — no PII, same privacy posture as the scan board. Explore is soft-ranked by it.
  const sp = await searchParams;
  const geoRegion = countryToRegion((await headers()).get("x-vercel-ip-country"));
  const region: Region = sp.region === "US" || sp.region === "UK" ? sp.region : geoRegion ?? "US";
  const explore = dbi ? await withRegionAvailability(dbi, lists, region) : [];

  return (
    <div className="relative flex min-h-screen flex-col">
      <SiteHeader width="wide" />
      {/* 1140px: the one documented extension of max-w-tool — a reading column can't hold a
          card grid (D-G5 handoff §0). */}
      <main className="mx-auto flex w-full max-w-[1140px] flex-1 flex-col px-5 pb-16 pt-8">
        <section className="mt-12 max-w-[680px] animate-fade-in">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-natural">Discover</p>
          <h1 className="mt-2 font-display text-4xl leading-[1.1] text-ink">
            Lists worth trusting.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            What the Baloo community is buying, keeping, and explaining — every product on every
            list broken down ingredient by ingredient.
          </p>
          <div className="mt-6">
            {/* useSearchParams requires a Suspense boundary. */}
            <Suspense fallback={null}>
              <SearchBox />
            </Suspense>
          </div>
        </section>

        <section className="mt-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-[23px] text-ink">Explore</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
                Shopping in
              </span>
              <div className="flex gap-1 rounded-full bg-canvas p-1">
                {REGIONS.map((r) => (
                  <Link
                    key={r.id}
                    href={`/discover?region=${r.id}`}
                    scroll={false}
                    aria-pressed={region === r.id}
                    className={`rounded-full px-3 py-1 text-[13px] font-medium transition ${
                      region === r.id
                        ? "bg-paper text-ink shadow-card"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {r.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          {explore.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              {viewer
                ? "You're following everyone with a public list right now — check your feed, or paste a product link on the home tool to start a list of your own."
                : "No public lists yet. Paste a product link on the home tool to analyse a product, then add it to your first list."}
            </p>
          ) : (
            <>
              <p className="mt-2 text-xs text-muted">
                Lists from across the community, ranked by what people are keeping — and by what you
                can actually buy in the {region}.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {explore.map((l) => (
                  <ListCard
                    key={l.id}
                    list={l}
                    handle={l.ownerHandle}
                    availability={l.availability}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        <section className="mt-12">
          <h2 className="font-display text-[23px] text-ink">Recently analysed</h2>
          {products.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              No products yet — analyse one on the homepage and it joins the catalog.
            </p>
          ) : (
            <ul className="mt-4 max-w-[760px] overflow-hidden rounded-2xl border border-line bg-paper shadow-card [&>li+li]:border-t [&>li+li]:border-line">
              {products.map((p) => (
                <ProductRow key={p.id} slug={p.slug} name={p.name} brand={p.brand} retailer={p.retailer} />
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
