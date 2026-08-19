"use client";

// OFF comparison tool (feat/off-compare, per Jitain's call): ONE query input driving TWO result
// panels side by side (stacked) so we can compare —
//   • Filtered pipeline  — what the live app shows: catalog + quality-gated, deduped OFF (/api/search)
//   • Raw Open Food Facts — exactly what OFF returns, no gate, no dedup, no country (/api/search/raw)
// The point is to SEE how messy the raw OFF data is versus our filter, and judge whether OFF is the
// right source or we should parse from elsewhere (ScrapingBee / Apify / parse.bot etc.). Tapping a row
// analyses it on demand (same path as the main search); a raw row with no ingredient list will dead-end
// on purpose — that is part of what the comparison reveals.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductRow } from "@/components/ProductRow";

type FilteredHit = {
  products: { id: string; name: string; brand: string | null; slug: string }[];
  off: { barcode: string; name: string; brand: string | null; quantity: string | null }[];
};
type RawHit = {
  off: {
    barcode: string;
    name: string;
    brand: string | null;
    quantity: string | null;
    completeness: number;
    hasIngredients: boolean;
    lang: string;
  }[];
};

export function OffCompare() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filtered, setFiltered] = useState<FilteredHit | null>(null);
  const [raw, setRaw] = useState<RawHit | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [analyzing, setAnalyzing] = useState<{ barcode: string; name: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function analyse(barcode: string, name: string) {
    setAnalyzing({ barcode, name });
    setErr(null);
    try {
      const res = await fetch("/api/off/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode }),
      });
      const data = await res.json();
      if (res.ok && data.ok && data.slug) {
        router.push(`/p/${data.slug}`);
        return;
      }
      setErr(
        res.status === 404
          ? "That product has no ingredient list on Open Food Facts."
          : "We couldn't analyse that right now. Please try again in a moment.",
      );
      setAnalyzing(null);
    } catch {
      setErr("We couldn't analyse that right now. Please try again in a moment.");
      setAnalyzing(null);
    }
  }

  const first = useRef(true);
  useEffect(() => {
    setErr(null);
    if (first.current) first.current = false;
    if (q.trim().length < 2) {
      setFiltered(null);
      setRaw(null);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const enc = encodeURIComponent(q.trim());
      // Both halves in parallel — the whole point is to compare the SAME query.
      const [f, r] = await Promise.all([
        fetch(`/api/search?q=${enc}`).then((res) => res.json()).catch(() => ({ products: [], off: [] })),
        fetch(`/api/search/raw?q=${enc}`).then((res) => res.json()).catch(() => ({ off: [] })),
      ]);
      setFiltered(f);
      setRaw(r);
      setSearched(true);
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // Filtered panel = catalog first, then gated OFF (mirrors the live app's one unified list).
  const filteredItems = filtered
    ? [
        ...filtered.products.map((p) => ({
          key: `c:${p.id}`, name: p.name, brand: p.brand, slug: p.slug, barcode: "", meta: p.brand ?? undefined,
        })),
        ...filtered.off.map((c) => ({
          key: `o:${c.barcode}`, name: c.name, brand: c.brand, slug: "", barcode: c.barcode,
          meta: [c.brand, c.quantity].filter(Boolean).join(" · ") || undefined,
        })),
      ]
    : [];
  const rawItems = raw?.off ?? [];

  if (analyzing) {
    return (
      <div className="mt-16 flex flex-col items-center gap-5 text-center" role="status" aria-live="polite">
        <span className="relative flex h-14 w-14 items-center justify-center" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-natural/20" />
          <span className="relative h-7 w-7 animate-spin rounded-full border-2 border-line border-t-natural" />
        </span>
        <p className="font-display text-[22px] leading-tight text-ink">Analysing {analyzing.name}…</p>
      </div>
    );
  }

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Compare search"
        placeholder="Search a product to compare filtered vs raw…"
        className="w-full rounded-full border border-line bg-paper px-5 py-3 text-ink shadow-card outline-none transition focus:border-natural focus:ring-2 focus:ring-natural/20"
      />

      {loading && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-natural" />
          Searching both…
        </p>
      )}

      {err && (
        <p className="mt-3 text-sm text-processed" role="alert">
          {err}
        </p>
      )}

      {searched && !loading && (
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          {/* Filtered pipeline */}
          <section>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-natural">
                Filtered pipeline
              </h2>
              <span className="text-xs tabular-nums text-muted">{filteredItems.length} shown</span>
            </div>
            <p className="mt-1 text-xs text-muted">What the live app shows — catalog + gated, deduped OFF.</p>
            {filteredItems.length ? (
              <ul className="mt-3 overflow-hidden rounded-2xl border border-line bg-paper shadow-card [&>li+li]:border-t [&>li+li]:border-line">
                {filteredItems.map((it) =>
                  it.slug ? (
                    <ProductRow key={it.key} slug={it.slug} name={it.name} brand={it.brand} meta={it.meta} />
                  ) : (
                    <ProductRow key={it.key} name={it.name} brand={it.brand} meta={it.meta} onClick={() => analyse(it.barcode, it.name)} />
                  ),
                )}
              </ul>
            ) : (
              <p className="mt-3 rounded-2xl border border-line bg-paper p-4 text-sm text-muted shadow-card">
                Nothing passes the filter for this query.
              </p>
            )}
          </section>

          {/* Raw OFF */}
          <section>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                Raw Open Food Facts
              </h2>
              <span className="text-xs tabular-nums text-muted">{rawItems.length} returned</span>
            </div>
            <p className="mt-1 text-xs text-muted">Unfiltered — no gate, no dedup, no country. Warts and all.</p>
            {rawItems.length ? (
              <ul className="mt-3 overflow-hidden rounded-2xl border border-line bg-paper shadow-card [&>li+li]:border-t [&>li+li]:border-line">
                {rawItems.map((c) => (
                  <ProductRow
                    key={c.barcode}
                    name={c.name}
                    brand={c.brand}
                    meta={
                      [
                        [c.brand, c.quantity].filter(Boolean).join(" · "),
                        c.lang ? c.lang.toUpperCase() : null,
                        `${Math.round(c.completeness * 100)}% complete`,
                        c.hasIngredients ? null : "no ingredient list",
                      ]
                        .filter(Boolean)
                        .join("  ·  ") || undefined
                    }
                    onClick={() => analyse(c.barcode, c.name)}
                  />
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-2xl border border-line bg-paper p-4 text-sm text-muted shadow-card">
                OFF returned nothing for this query.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
