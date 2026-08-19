"use client";

// OFF comparison tool (feat/off-compare, per Jitain's call): ONE query input driving THREE result
// panels side by side so we can compare data sources for the same query —
//   • Filtered pipeline   — what the live app shows: catalog + quality-gated, deduped OFF (/api/search)
//   • Raw Open Food Facts  — exactly what OFF returns, no gate, no dedup, no country (/api/search/raw)
//   • Commercial DB        — the paid barcode DB (BarcodeNest / Chomp) looked up on the SAME barcodes
//                            OFF surfaced (/api/compare/commercial), so we can see whether its
//                            ingredient data is cleaner / better-covered than OFF's.
// The point is to judge whether OFF is the right source or a paid source is worth it. Tapping an OFF
// row analyses it; a raw row with no ingredient list dead-ends on purpose — part of what this reveals.

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
type CommercialResult = {
  barcode: string;
  found: boolean;
  name: string | null;
  brand: string | null;
  ingredients: string | null;
  provider: string;
};
type CommercialHit = { configured: boolean; provider: string | null; results: CommercialResult[] };

export function OffCompare() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filtered, setFiltered] = useState<FilteredHit | null>(null);
  const [raw, setRaw] = useState<RawHit | null>(null);
  const [commercial, setCommercial] = useState<CommercialHit | null>(null);
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
      setCommercial(null);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const enc = encodeURIComponent(q.trim());
      // Filtered + raw in parallel (same query is the whole point of the comparison).
      const [f, r] = await Promise.all([
        fetch(`/api/search?q=${enc}`).then((res) => res.json()).catch(() => ({ products: [], off: [] })),
        fetch(`/api/search/raw?q=${enc}`).then((res) => res.json()).catch(() => ({ off: [] })),
      ]);
      setFiltered(f);
      setRaw(r);
      // Then look the raw barcodes up in the paid DB (depends on r) — the third panel.
      const barcodes = (r?.off ?? []).map((x: RawHit["off"][number]) => x.barcode);
      const comm: CommercialHit | null = barcodes.length
        ? await fetch("/api/compare/commercial", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ barcodes }),
          })
            .then((res) => res.json())
            .catch(() => null)
        : { configured: false, provider: null, results: [] };
      setCommercial(comm);
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
  const commByBarcode = new Map((commercial?.results ?? []).map((r) => [r.barcode, r]));

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
        placeholder="Search a product to compare sources…"
        className="w-full rounded-full border border-line bg-paper px-5 py-3 text-ink shadow-card outline-none transition focus:border-natural focus:ring-2 focus:ring-natural/20"
      />

      {loading && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-natural" />
          Searching all sources…
        </p>
      )}

      {err && (
        <p className="mt-3 text-sm text-processed" role="alert">
          {err}
        </p>
      )}

      {searched && !loading && (
        <div className="mt-6 grid gap-8 lg:grid-cols-3">
          {/* 1 · Filtered pipeline */}
          <section>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-natural">Filtered pipeline</h2>
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

          {/* 2 · Raw OFF */}
          <section>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Raw Open Food Facts</h2>
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

          {/* 3 · Commercial DB — same barcodes, looked up in the paid source */}
          <section>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                Commercial DB{commercial?.provider ? ` · ${commercial.provider}` : ""}
              </h2>
              {commercial?.configured && (
                <span className="text-xs tabular-nums text-muted">
                  {(commercial.results ?? []).filter((r) => r.found && r.ingredients).length}/{rawItems.length} w/ ingredients
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">Same barcodes as raw OFF, looked up in the paid DB (first 10).</p>

            {!commercial?.configured ? (
              <div className="mt-3 rounded-2xl border border-dashed border-line bg-paper p-4 text-sm shadow-card">
                <p className="text-ink">Not configured.</p>
                <p className="mt-1 text-muted">
                  Add a server-side key to enable this panel — <code className="rounded bg-canvas px-1 py-0.5 text-[12px]">BARCODENEST_API_KEY</code>{" "}
                  (free tier) or <code className="rounded bg-canvas px-1 py-0.5 text-[12px]">CHOMP_API_KEY</code> in{" "}
                  <code className="rounded bg-canvas px-1 py-0.5 text-[12px]">.env.local</code>, then restart the dev server.
                </p>
              </div>
            ) : rawItems.length ? (
              <ul className="mt-3 overflow-hidden rounded-2xl border border-line bg-paper shadow-card [&>li+li]:border-t [&>li+li]:border-line">
                {rawItems.map((c) => {
                  const rec = commByBarcode.get(c.barcode);
                  const status = !rec
                    ? { label: "not looked up", tone: "text-muted" }
                    : !rec.found
                      ? { label: "not in DB", tone: "text-processed" }
                      : rec.ingredients
                        ? { label: "has ingredients", tone: "text-natural" }
                        : { label: "found · no ingredients", tone: "text-processed" };
                  return (
                    <li key={c.barcode} className="px-4 py-3 sm:px-5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate font-display text-[17px] leading-tight text-ink">
                          {rec?.name || c.name}
                        </span>
                        <span className={`shrink-0 text-[11px] font-medium ${status.tone}`}>{status.label}</span>
                      </div>
                      {rec?.ingredients && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted">{rec.ingredients}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 rounded-2xl border border-line bg-paper p-4 text-sm text-muted shadow-card">
                No barcodes to look up.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
