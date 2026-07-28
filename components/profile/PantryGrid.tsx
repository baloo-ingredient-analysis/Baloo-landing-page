"use client";

// The Pantry tab (Order PP2) — a grid of your SAVED PRODUCTS with an instant name-search. Owner-only
// and private (the page never renders this for a visitor). Client so the search filters the loaded set
// with no round-trip; a server-side search is a later upgrade once pantries grow. Order PP3 extends
// this with "Create list" + a selection mode.

import { useMemo, useState } from "react";
import Link from "next/link";

export type PantryProduct = { id: string; slug: string; name: string; brand: string | null };

export function PantryGrid({ products }: { products: PantryProduct[] }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const shown = useMemo(
    () =>
      term
        ? products.filter(
            (p) =>
              p.name.toLowerCase().includes(term) ||
              (p.brand ?? "").toLowerCase().includes(term),
          )
        : products,
    [products, term],
  );

  if (products.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-line bg-paper p-8 text-center shadow-card">
        <p className="font-display text-lg text-ink">Your pantry is empty</p>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">
          Tap Save on any product you want to keep — they collect here.
        </p>
        <Link
          href="/discover"
          className="mt-4 inline-flex rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink/85"
        >
          Find products
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        type="search"
        placeholder="Search your pantry…"
        aria-label="Search your pantry"
        className="w-full max-w-sm rounded-full border border-line bg-paper px-4 py-2 text-[15px] text-ink outline-none transition placeholder:text-muted focus:border-natural focus:shadow-[0_0_0_2px_rgba(46,125,82,0.2)]"
      />

      {shown.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No products match “{q}”.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((p) => (
            <li key={p.id}>
              <Link
                href={`/p/${p.slug}`}
                className="group block overflow-hidden rounded-2xl border border-line bg-paper shadow-card transition duration-200 hover:shadow-card-hover"
              >
                <div className="flex h-24 items-center justify-center bg-canvas">
                  <span aria-hidden className="font-display text-4xl text-ink/25">
                    {(p.brand ?? p.name)[0]?.toUpperCase()}
                  </span>
                </div>
                <div className="p-3">
                  <p className="truncate font-display text-[15px] leading-tight text-ink">{p.name}</p>
                  {p.brand && (
                    <p className="mt-0.5 truncate text-xs uppercase tracking-[0.08em] text-muted">
                      {p.brand}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
