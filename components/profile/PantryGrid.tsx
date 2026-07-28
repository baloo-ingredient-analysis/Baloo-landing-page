"use client";

// The Pantry tab (Order PP2 + PP3) — a grid of your SAVED PRODUCTS with an instant name-search, plus
// the Pinterest-style "Create list" flow: name a list (CreateListModal), then the grid drops into a
// SELECTION MODE where you tick which saved products go into the new list. Owner-only and private.
// Client so search + selection have no round-trip; server-side search is a later upgrade.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreateListModal } from "./CreateListModal";

export type PantryProduct = { id: string; slug: string; name: string; brand: string | null };

function CardBody({ p }: { p: PantryProduct }) {
  return (
    <>
      <div className="flex h-24 items-center justify-center bg-canvas">
        <span aria-hidden className="font-display text-4xl text-ink/25">
          {(p.brand ?? p.name)[0]?.toUpperCase()}
        </span>
      </div>
      <div className="p-3">
        <p className="truncate font-display text-[15px] leading-tight text-ink">{p.name}</p>
        {p.brand && (
          <p className="mt-0.5 truncate text-xs uppercase tracking-[0.08em] text-muted">{p.brand}</p>
        )}
      </div>
    </>
  );
}

export function PantryGrid({ products }: { products: PantryProduct[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [building, setBuilding] = useState<{ id: string; slug: string; title: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const selecting = building !== null;

  const term = q.trim().toLowerCase();
  const shown = useMemo(
    () =>
      term
        ? products.filter(
            (p) =>
              p.name.toLowerCase().includes(term) || (p.brand ?? "").toLowerCase().includes(term),
          )
        : products,
    [products, term],
  );

  function toggleSel(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function cancelBuild() {
    setBuilding(null);
    setSelected(new Set());
  }

  async function addSelected() {
    if (!building || selected.size === 0 || adding) return;
    setAdding(true);
    try {
      await Promise.all(
        [...selected].map((productId) =>
          fetch(`/api/lists/${building.id}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId }),
          }),
        ),
      );
      router.push(`/list/${building.slug}`);
    } finally {
      setAdding(false);
    }
  }

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
      {selecting ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-canvas px-4 py-3">
          <p className="text-sm text-ink">
            Pick products for <span className="font-semibold">{building!.title}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelBuild}
              className="rounded-full border border-line bg-paper px-3.5 py-1.5 text-[13px] font-medium text-ink transition hover:border-ink/20"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={addSelected}
              disabled={selected.size === 0 || adding}
              className="rounded-full bg-ink px-4 py-1.5 text-[13px] font-medium text-paper transition hover:bg-ink/85 disabled:opacity-50"
            >
              {adding
                ? "Adding…"
                : selected.size === 0
                  ? "Select products"
                  : `Add ${selected.size} to list`}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            type="search"
            placeholder="Search your pantry…"
            aria-label="Search your pantry"
            className="w-full max-w-xs rounded-full border border-line bg-paper px-4 py-2 text-[15px] text-ink outline-none transition placeholder:text-muted focus:border-natural focus:shadow-[0_0_0_2px_rgba(46,125,82,0.2)]"
          />
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink/85"
          >
            Create list
          </button>
        </div>
      )}

      {shown.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No products match “{q}”.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((p) => {
            const isSel = selected.has(p.id);
            const cardBase =
              "group relative block w-full overflow-hidden rounded-2xl border bg-paper text-left shadow-card transition duration-200";
            return (
              <li key={p.id}>
                {selecting ? (
                  <button
                    type="button"
                    onClick={() => toggleSel(p.id)}
                    aria-pressed={isSel}
                    className={`${cardBase} ${
                      isSel ? "border-ink ring-2 ring-ink" : "border-line hover:shadow-card-hover"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border text-[11px] ${
                        isSel ? "border-ink bg-ink text-paper" : "border-line bg-paper/90 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <CardBody p={p} />
                  </button>
                ) : (
                  <Link href={`/p/${p.slug}`} className={`${cardBase} border-line hover:shadow-card-hover`}>
                    <CardBody p={p} />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {createOpen && (
        <CreateListModal
          onClose={() => setCreateOpen(false)}
          onCreated={(list) => {
            setCreateOpen(false);
            setBuilding(list);
            setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}
