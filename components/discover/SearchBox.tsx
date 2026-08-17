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
  products: { id: string; name: string; brand: string | null; slug: string }[];
  lists: { id: string; slug: string; title: string; itemCount: number; ownerHandle: string | null }[];
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
  const [off, setOff] = useState<{ state: "idle" | "loading" | "error"; msg?: string }>({ state: "idle" });
  const first = useRef(true);

  // Catalog miss → look the product up in Open Food Facts, analyse once, and go to its page.
  async function analyseFromOff() {
    const query = q.trim();
    if (query.length < 2) return;
    setOff({ state: "loading" });
    try {
      const res = await fetch("/api/off/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (res.ok && data.ok && data.slug) {
        router.push(`/p/${data.slug}`);
        return;
      }
      setOff({
        state: "error",
        msg:
          res.status === 404
            ? "We couldn't find that in Open Food Facts either — try a more specific name."
            : "We couldn't analyse that right now. Please try again in a moment.",
      });
    } catch {
      setOff({ state: "error", msg: "We couldn't analyse that right now. Please try again in a moment." });
    }
  }

  useEffect(() => {
    setOff({ state: "idle" }); // a new query clears any prior OFF result/error
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
        setHits({ products: [], lists: [] });
      }
      setSearched(true);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, router, basePath]);

  const nP = hits?.products.length ?? 0;
  const nL = hits?.lists.length ?? 0;
  const empty = searched && !loading && nP === 0 && nL === 0;
  const showLists = filter !== "products" && nL > 0;
  const showProducts = filter !== "lists" && nP > 0;

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search products and lists"
        placeholder="Search products and lists…"
        className="w-full rounded-full border border-line bg-paper px-5 py-3 text-ink shadow-card outline-none transition focus:border-natural focus:ring-2 focus:ring-natural/20"
      />

      {loading && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-natural"
          />
          Searching…
        </p>
      )}

      {searched && !loading && hits && (nP > 0 || nL > 0) && (
        <div className="mt-5 animate-fade-in">
          <p className="text-sm tabular-nums text-muted">
            {nP + nL} {nP + nL === 1 ? "result" : "results"}
            {" · "}
            {nL} {nL === 1 ? "list" : "lists"}, {nP} {nP === 1 ? "product" : "products"}
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
                {hits.products.map((p) => (
                  <ProductRow key={p.id} slug={p.slug} name={p.name} brand={p.brand} />
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {empty && (
        <div className="mt-5 max-w-[640px] animate-fade-in rounded-2xl border border-line bg-paper p-5 shadow-card">
          <p className="text-sm text-ink">Not in our catalog yet — no matches for &quot;{q.trim()}&quot;.</p>
          <p className="mt-1 text-sm text-muted">
            We can look it up in Open Food Facts and break down its ingredients for you.
          </p>
          <button
            type="button"
            onClick={analyseFromOff}
            disabled={off.state === "loading"}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper transition hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {off.state === "loading" && (
              <span
                aria-hidden
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-paper/40 border-t-paper"
              />
            )}
            {off.state === "loading" ? "Looking it up…" : `Analyse "${q.trim()}"`}
          </button>
          {off.state === "error" && off.msg && (
            <p className="mt-2 text-sm text-processed" role="alert">
              {off.msg}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
