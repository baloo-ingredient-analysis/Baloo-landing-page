"use client";

// Discover search (Order G5, restyled per the D-G5 handoff §4): debounced /api/search with ?q=
// URL state, a segmented All/Products/Lists filter, tabular count line, brand-initial thumbnails,
// and — on a catalog miss — the OFF fallback (Order OFF4): look the product up in Open Food Facts,
// analyse it once, and jump to its page. This replaced the old "paste the product link" bridge now
// that scraping retailers is a dead end.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductRow, RowChevron } from "@/components/ProductRow";

type Hit = {
  products: { id: string; name: string; brand: string | null; slug: string; rank?: number }[];
  lists: { id: string; slug: string; title: string; itemCount: number; ownerHandle: string | null }[];
  off: { barcode: string; name: string; brand: string | null; quantity: string | null; rank?: number }[];
};

type Filter = "all" | "products" | "lists";

export function SearchBox({ basePath = "/discover" }: { basePath?: string } = {}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [hits, setHits] = useState<Hit | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  // The product currently being imported/analysed (barcode + name), so we can show a full "analysing"
  // screen instead of just a tiny button spinner during the ~10-30s Claude call.
  const [analyzing, setAnalyzing] = useState<{ barcode: string; name: string } | null>(null);
  const [offErr, setOffErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false); // "Show more" — reveal the rest of the products
  const first = useRef(true);

  // Analyse a specific Open Food Facts product on demand: import it (analyse once, cache), then go
  // to its page. Picking a candidate is exact, so we pass the barcode, not the query.
  async function analyseCandidate(barcode: string, name: string) {
    setAnalyzing({ barcode, name });
    setOffErr(null);
    try {
      const res = await fetch("/api/off/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode }),
      });
      const data = await res.json();
      if (res.ok && data.ok && data.slug) {
        router.push(`/p/${data.slug}`);
        return; // keep the analysing screen up through navigation (don't flash the list back)
      }
      setOffErr(
        res.status === 404
          ? "That product has no ingredient list on Open Food Facts."
          : "We couldn't analyse that right now. Please try again in a moment.",
      );
      setAnalyzing(null);
    } catch {
      setOffErr("We couldn't analyse that right now. Please try again in a moment.");
      setAnalyzing(null);
    }
  }

  useEffect(() => {
    setOffErr(null); // a new query clears any prior OFF error
    setExpanded(false); // a new query collapses back to the first page of products
    if (first.current) first.current = false;
    else {
      const url = q.trim() ? `${basePath}?q=${encodeURIComponent(q.trim())}` : basePath;
      router.replace(url, { scroll: false });
    }

    if (q.trim().length < 2) {
      setHits(null);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        setHits(await res.json());
      } catch {
        setHits({ products: [], lists: [], off: [] });
      }
      setSearched(true);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, router, basePath]);

  // Catalog products (ready to view) + OFF candidates (analyse on tap) are ONE product list — the user
  // shouldn't have to care which is which. Catalog first (we already have them), then OFF.
  const nCatalog = hits?.products.length ?? 0;
  const nOff = hits?.off?.length ?? 0;
  const nProducts = nCatalog + nOff;
  const nL = hits?.lists.length ?? 0;
  const empty = searched && !loading && nProducts === 0 && nL === 0;
  const showLists = filter !== "products" && nL > 0;
  const showProducts = filter !== "lists" && nProducts > 0;

  // Catalog + OFF as ONE product list, ordered by the server's cross-group `rank` (query relevance,
  // catalog winning ties) so a strong OFF match can lead a weak catalog one. "Show more" reveals the rest.
  const INITIAL_PRODUCTS = 6;
  const productItems = hits
    ? [
        ...hits.products.map((p) => ({
          type: "catalog" as const, key: p.id, name: p.name, brand: p.brand, slug: p.slug, quantity: null as string | null, barcode: "", rank: p.rank ?? 0,
        })),
        ...hits.off.map((c) => ({
          type: "off" as const, key: c.barcode, name: c.name, brand: c.brand, slug: "", quantity: c.quantity, barcode: c.barcode, rank: c.rank ?? Number.MAX_SAFE_INTEGER,
        })),
      ].sort((a, b) => a.rank - b.rank)
    : [];
  const visibleProducts = expanded ? productItems : productItems.slice(0, INITIAL_PRODUCTS);

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        disabled={analyzing !== null}
        aria-label="Search products and lists"
        placeholder="Search products and lists…"
        className="w-full rounded-full border border-line bg-paper px-5 py-3 text-ink shadow-card outline-none transition focus:border-natural focus:ring-2 focus:ring-natural/20 disabled:opacity-60"
      />

      {/* Analysing screen — a full, animated state while the ~10-30s import + Claude call runs, so it
          never feels frozen. Stays up through the redirect to the product page. */}
      {analyzing && (
        <div className="mt-12 flex flex-col items-center gap-5 text-center animate-fade-in" role="status" aria-live="polite">
          <span className="relative flex h-14 w-14 items-center justify-center" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-natural/20" />
            <span className="absolute inline-flex h-9 w-9 animate-pulse rounded-full bg-natural/15" />
            <span className="relative h-7 w-7 animate-spin rounded-full border-2 border-line border-t-natural" />
          </span>
          <div>
            <p className="font-display text-[23px] leading-tight text-ink">
              Analysing {analyzing.name}…
            </p>
            <p className="mt-1.5 text-sm text-muted">
              This takes a few seconds — we&rsquo;re reading the label and explaining every ingredient.
            </p>
          </div>
        </div>
      )}

      {!analyzing && loading && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-natural"
          />
          Searching…
        </p>
      )}

      {!analyzing && searched && !loading && hits && (nProducts > 0 || nL > 0) && (
        <div className="mt-5 animate-fade-in">
          <p className="text-sm tabular-nums text-muted">
            {nProducts + nL} {nProducts + nL === 1 ? "result" : "results"}
            {" · "}
            {nL} {nL === 1 ? "list" : "lists"}, {nProducts} {nProducts === 1 ? "product" : "products"}
          </p>

          {/* Segmented filter — active pill = ink fill (D-G5 §4). */}
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter results">
            {(["all", "products", "lists"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
                  filter === f
                    ? "bg-ink text-paper"
                    : "border border-line bg-paper text-ink/70 hover:bg-canvas"
                }`}
              >
                {f === "all" ? "All" : f === "products" ? "Products" : "Lists"}
              </button>
            ))}
          </div>

          {showLists && (
            <>
              <h2 className="mt-6 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                Lists
              </h2>
              <ul className="mt-2 max-w-[760px] overflow-hidden rounded-2xl border border-line bg-paper shadow-card [&>li+li]:border-t [&>li+li]:border-line">
                {hits.lists.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/list/${l.slug}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-canvas"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-display text-[17px] text-ink">
                          {l.title}
                        </span>
                        <span className="text-xs tabular-nums text-muted">
                          {l.itemCount} {l.itemCount === 1 ? "product" : "products"}
                          {l.ownerHandle && ` · @${l.ownerHandle}`}
                        </span>
                      </span>
                      <RowChevron />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {showProducts && (
            <>
              <h2 className="mt-6 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                Products
              </h2>
              <ul className="mt-2 max-w-[760px] overflow-hidden rounded-2xl border border-line bg-paper shadow-card [&>li+li]:border-t [&>li+li]:border-line">
                {visibleProducts.map((it) =>
                  it.type === "catalog" ? (
                    // Already analysed — open instantly.
                    <ProductRow key={it.key} slug={it.slug} name={it.name} brand={it.brand} />
                  ) : (
                    // From Open Food Facts — tapping analyses it, then opens (same list, no separate step).
                    <ProductRow
                      key={it.key}
                      name={it.name}
                      brand={it.brand}
                      meta={[it.brand, it.quantity].filter(Boolean).join(" · ") || undefined}
                      onClick={() => analyseCandidate(it.barcode, it.name)}
                    />
                  ),
                )}
              </ul>
              {!expanded && nProducts > INITIAL_PRODUCTS && (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="mt-3 text-sm font-medium text-natural hover:underline"
                >
                  Show {nProducts - INITIAL_PRODUCTS} more
                </button>
              )}
              {offErr && (
                <p className="mt-2 text-sm text-processed" role="alert">
                  {offErr}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {!analyzing && empty && (
        <div className="mt-5 max-w-[640px] animate-fade-in rounded-2xl border border-line bg-paper p-5 shadow-card">
          <p className="text-sm text-ink">No matches for &quot;{q.trim()}&quot;.</p>
          <p className="mt-1 text-sm text-muted">
            We couldn&rsquo;t find it in our catalog or on Open Food Facts — try a more specific name or
            brand.
          </p>
        </div>
      )}
    </div>
  );
}
