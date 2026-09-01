"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ListCover } from "./ListCover";

type Item = { productId: string; name: string; brand: string | null; slug: string; note: string };
// A picker hit is either an analysed catalog product (add instantly) or a live Open Food Facts
// candidate that must be analysed first (analyse-and-add). `barcode` is set only for OFF hits.
type SearchHit = {
  kind: "catalog" | "off";
  id: string;
  name: string;
  brand: string | null;
  slug: string;
  barcode: string;
};
// An OFF pick being analysed in the background. It shows in the list right away as a placeholder
// ("Analysing…") and either resolves into a real Item or flips to "failed" (retry/dismiss) — the
// builder stays fully usable while several run at once. Keyed by barcode.
type Pending = { barcode: string; name: string; brand: string | null; status: "analysing" | "failed" };
type Initial = {
  id: string;
  slug: string;
  title: string;
  description: string;
  isPublic: boolean;
  items: Item[];
  pending: Pending[];
};
type Save = "idle" | "saving" | "saved";

// The list editor (Order G4). Autosaves every change to the API; the item order/notes/metadata
// all persist as you go. Reorder is drag-and-drop with keyboard ↑/↓ for accessibility.
export function ListEditor({ initial }: { initial: Initial }) {
  const listId = initial.id;
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [isPublic, setIsPublic] = useState(initial.isPublic);
  const [items, setItems] = useState<Item[]>(initial.items);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [pending, setPending] = useState<Pending[]>(initial.pending); // OFF picks analysing (persisted)
  const [save, setSave] = useState<Save>("idle");
  const [recents, setRecents] = useState<SearchHit[]>([]); // owner's recently-added products (pre-typing)
  const [recentsOpen, setRecentsOpen] = useState(false); // the "Recently added" strip is collapsed by default
  const dragFrom = useRef<number | null>(null);

  const flashSaved = useCallback(() => {
    setSave("saved");
    setTimeout(() => setSave("idle"), 1400);
  }, []);

  const patchList = useCallback(
    async (patch: Record<string, unknown>) => {
      setSave("saving");
      await fetch(`/api/lists/${listId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).catch(() => {});
      flashSaved();
    },
    [listId, flashSaved],
  );

  // Debounced product search.
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        // The same OFF-backed search the homepage uses (catalog + live Open Food Facts, deduped +
        // ranked), so the builder can add ANY product — not just ones already analysed. Catalog hits
        // add instantly; OFF hits are analysed on add.
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        const cat: SearchHit[] = (data.products ?? []).map(
          (p: { id: string; name: string; brand: string | null; slug: string }) => ({
            kind: "catalog" as const, id: p.id, name: p.name, brand: p.brand, slug: p.slug, barcode: "",
          }),
        );
        const off: SearchHit[] = (data.off ?? [])
          .filter((c: { barcode?: string }) => !!c.barcode) // analyse-and-add needs a barcode
          .map((c: { barcode: string; name: string; brand: string | null }) => ({
            kind: "off" as const, id: "", name: c.name, brand: c.brand, slug: "", barcode: c.barcode,
          }));
        setResults([...cat, ...off]); // catalog first — instant adds ahead of analyse-on-add
      } catch {
        setResults([]);
      }
      setSearched(true);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // Load the owner's recently-added products once, for the picker's pre-typing strip.
  useEffect(() => {
    let live = true;
    fetch("/api/lists/recents")
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((d) => {
        if (!live) return;
        setRecents(
          (d.products ?? []).map((p: { id: string; name: string; brand: string | null; slug: string }) => ({
            kind: "catalog" as const, id: p.id, name: p.name, brand: p.brand, slug: p.slug, barcode: "",
          })),
        );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  async function addProduct(hit: SearchHit) {
    if (items.some((i) => i.productId === hit.id)) return;
    setItems((prev) => [...prev, { productId: hit.id, name: hit.name, brand: hit.brand, slug: hit.slug, note: "" }]);
    setQ("");
    setResults([]);
    setSave("saving");
    await fetch(`/api/lists/${listId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: hit.id }),
    }).catch(() => {});
    flashSaved();
  }

  // Persist a pending row's state server-side so an in-flight (or failed) analysis survives a reload.
  const patchPending = useCallback(
    (barcode: string, status: "analysing" | "failed") =>
      fetch(`/api/lists/${listId}/items/pending`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode, status }),
      }).catch(() => {}),
    [listId],
  );
  const deletePendingRow = useCallback(
    (barcode: string) =>
      fetch(`/api/lists/${listId}/items/pending?barcode=${encodeURIComponent(barcode)}`, {
        method: "DELETE",
      }).catch(() => {}),
    [listId],
  );

  // Analyse one OFF pick in the background: /api/off/lookup runs the Claude pass once (or reuses a
  // known product), so it can take ~a minute. We don't block on it — the item sits in the list as an
  // "Analysing…" placeholder and resolves into a real product when it lands (idempotent on the server,
  // so a duplicate is harmless). On failure it flips to a persisted "couldn't analyse" state.
  const resolveOff = useCallback(
    async (p: { barcode: string; name: string; brand: string | null }) => {
      try {
        const res = await fetch("/api/off/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barcode: p.barcode }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok || !data.productId) throw new Error("analyse_failed");
        // Persist the real item and CONFIRM it saved BEFORE dropping the placeholder. (The bug: this
        // write was fire-and-forget and the placeholder was removed immediately, so a reload racing the
        // request lost BOTH the item and the placeholder.) Keeping the pending row until the save is
        // confirmed means a reload simply resumes and re-saves — nothing can vanish.
        setSave("saving");
        const saved = await fetch(`/api/lists/${listId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: data.productId }),
        })
          .then((r) => r.ok)
          .catch(() => false);
        if (!saved) throw new Error("save_failed"); // keep the pending row; fall to the failed state
        setItems((prev) =>
          prev.some((i) => i.productId === data.productId)
            ? prev
            : [...prev, { productId: data.productId, name: p.name, brand: p.brand, slug: data.slug, note: "" }],
        );
        setPending((prev) => prev.filter((x) => x.barcode !== p.barcode));
        await deletePendingRow(p.barcode); // the real item now stands in for it
        flashSaved();
      } catch {
        setPending((prev) => prev.map((x) => (x.barcode === p.barcode ? { ...x, status: "failed" } : x)));
        void patchPending(p.barcode, "failed");
      }
    },
    [listId, flashSaved, deletePendingRow, patchPending],
  );

  // OFF candidate from the picker: persist a placeholder (so it survives a reload), then queue the
  // analysis. The builder stays usable and several picks can run at once. We AWAIT the placeholder
  // write before starting the analysis so a reload always finds the row to resume.
  async function addOffCandidate(hit: SearchHit) {
    if (!hit.barcode) return; // no barcode → can't analyse-and-add
    if (pending.some((p) => p.barcode === hit.barcode && p.status === "analysing")) return;
    setPending((prev) => [
      ...prev.filter((p) => p.barcode !== hit.barcode),
      { barcode: hit.barcode, name: hit.name, brand: hit.brand, status: "analysing" },
    ]);
    setQ("");
    setResults([]);
    const queued = await fetch(`/api/lists/${listId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode: hit.barcode, name: hit.name, brand: hit.brand ?? "" }),
    })
      .then((r) => r.ok)
      .catch(() => false);
    if (!queued) {
      // Couldn't even persist the placeholder — show the failed state instead of a ghost that vanishes.
      setPending((prev) => prev.map((x) => (x.barcode === hit.barcode ? { ...x, status: "failed" } : x)));
      return;
    }
    void resolveOff(hit);
  }

  function retryPending(p: Pending) {
    setPending((prev) => prev.map((x) => (x.barcode === p.barcode ? { ...x, status: "analysing" } : x)));
    void patchPending(p.barcode, "analysing");
    void resolveOff(p);
  }

  function dismissPending(barcode: string) {
    setPending((prev) => prev.filter((p) => p.barcode !== barcode));
    void deletePendingRow(barcode);
  }

  // Resume any analysis a previous session left in flight (tab closed mid-analyse). Runs once; the
  // lookup is idempotent, so a since-completed one resolves instantly.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    for (const p of initial.pending) if (p.status === "analysing") void resolveOff(p);
  }, [initial.pending, resolveOff]);

  async function removeProduct(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
    setSave("saving");
    await fetch(`/api/lists/${listId}/items?productId=${productId}`, { method: "DELETE" }).catch(() => {});
    flashSaved();
  }

  async function saveNote(productId: string, note: string) {
    setSave("saving");
    await fetch(`/api/lists/${listId}/items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, note }),
    }).catch(() => {});
    flashSaved();
  }

  async function persistOrder(next: Item[]) {
    setItems(next);
    setSave("saving");
    await fetch(`/api/lists/${listId}/items`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((i) => i.productId) }),
    }).catch(() => {});
    flashSaved();
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persistOrder(next);
  }

  return (
    <section className="mt-8 animate-fade-in pb-16">
      <div className="flex items-start gap-4">
        <ListCover title={title || "L"} seed={initial.slug} className="h-24 w-40 shrink-0 rounded-xl" monogramClassName="text-4xl" />
        <div className="min-w-0 flex-1">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => patchList({ title })}
            aria-label="List title"
            placeholder="Untitled list"
            className="w-full bg-transparent font-display text-2xl text-ink outline-none placeholder:text-muted"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => patchList({ description })}
            aria-label="Description"
            placeholder="What's this list about?"
            rows={2}
            className="mt-1 w-full resize-none bg-transparent text-sm text-ink/80 outline-none placeholder:text-muted"
          />
        </div>
        {/* Editing controls live WITH the list, not in the top bar. Everything autosaves, so "Done" is
            simply "finished — take me to the list". */}
        <Link
          href={`/list/${initial.slug}`}
          className="shrink-0 rounded-full bg-ink px-4 py-1.5 text-[13px] font-medium text-paper transition hover:bg-ink/85"
        >
          Done
        </Link>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => {
              setIsPublic(e.target.checked);
              patchList({ isPublic: e.target.checked });
            }}
            className="h-4 w-4 accent-natural"
          />
          {isPublic ? "Public — anyone with the link" : "Make public to share"}
        </label>
        <span className="text-xs text-muted" aria-live="polite">
          {save === "saving" ? "Saving…" : save === "saved" ? "Saved" : ""}
        </span>
      </div>

      {/* Add via search */}
      <div className="relative mt-6">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Add a product by name"
          placeholder="Add a product — search any product by name"
          className="w-full rounded-lg border border-line bg-canvas px-4 py-2.5 text-ink outline-none transition focus:border-natural focus:ring-2 focus:ring-natural/20"
        />
        {q.trim().length >= 2 && (
          <div className="absolute z-10 mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-paper shadow-hero">
            {results.length > 0 ? (
              <ul>
                {results.map((hit) => {
                  const already = hit.kind === "catalog" && items.some((i) => i.productId === hit.id);
                  const queued = hit.kind === "off" && pending.some((p) => p.barcode === hit.barcode);
                  const label = already
                    ? "Added"
                    : hit.kind === "off"
                      ? queued
                        ? "Analysing…"
                        : "Analyse & add"
                      : "Add";
                  return (
                    <li key={hit.kind === "catalog" ? hit.id : hit.barcode}>
                      <button
                        type="button"
                        disabled={already || queued}
                        onClick={() => (hit.kind === "catalog" ? addProduct(hit) : addOffCandidate(hit))}
                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-canvas disabled:opacity-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-ink">{hit.name}</span>
                          {hit.brand && <span className="text-xs uppercase tracking-[0.08em] text-muted">{hit.brand}</span>}
                        </span>
                        <span className="shrink-0 text-xs text-muted">{label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              searched && (
                <p className="px-4 py-3 text-sm text-muted">
                  No products match that. Try a brand or a simpler word.
                </p>
              )
            )}
          </div>
        )}
      </div>

      {/* Recently added (pre-typing): the owner's recent products, one tap to re-add a staple — and
          being their own products, it doubles as "own products first". A collapsed-by-default toggle so
          it never crowds the builder; in-list ones read "Added". Hidden once you start typing. */}
      {q.trim().length < 2 && recents.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-xl border border-line bg-paper shadow-card">
          <button
            type="button"
            onClick={() => setRecentsOpen((o) => !o)}
            aria-expanded={recentsOpen}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-canvas"
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Recently added
            </span>
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className={`h-4 w-4 shrink-0 text-muted transition-transform ${recentsOpen ? "rotate-180" : ""}`}
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>
          {recentsOpen && (
            <ul className="border-t border-line [&>li+li]:border-t [&>li+li]:border-line">
              {recents.map((hit) => {
                const already = items.some((i) => i.productId === hit.id);
                return (
                  <li key={hit.id}>
                    <button
                      type="button"
                      disabled={already}
                      onClick={() => addProduct(hit)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-canvas disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-ink">{hit.name}</span>
                        {hit.brand && <span className="text-xs uppercase tracking-[0.08em] text-muted">{hit.brand}</span>}
                      </span>
                      <span className="shrink-0 text-xs text-muted">{already ? "Added" : "Add"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* In this list */}
      <h2 className="mt-6 text-xs font-semibold uppercase tracking-[0.12em] text-ink">In this list</h2>

      {/* Background analyses (OFF picks). Placeholders that resolve into real items, or offer retry. */}
      {pending.length > 0 && (
        <ul className="mt-3 overflow-hidden rounded-2xl border border-dashed border-line bg-canvas [&>li+li]:border-t [&>li+li]:border-line">
          {pending.map((p) => (
            <li key={p.barcode} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-base leading-tight text-ink/70">{p.name}</span>
                {p.brand && <span className="text-xs uppercase tracking-[0.08em] text-muted">{p.brand}</span>}
              </span>
              {p.status === "analysing" ? (
                <span className="shrink-0 animate-pulse text-xs text-muted" aria-live="polite">
                  Analysing…
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-3 text-xs">
                  <span className="text-processed">Couldn&apos;t analyse</span>
                  <button type="button" onClick={() => retryPending(p)} className="text-ink underline underline-offset-2 transition hover:text-natural">
                    Retry
                  </button>
                  <button type="button" onClick={() => dismissPending(p.barcode)} className="text-muted transition hover:text-ink">
                    Dismiss
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {items.length === 0 && pending.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Nothing added yet. Add the product above, or search — then drag to set the order.
        </p>
      ) : items.length === 0 ? null : (
        <ul className="mt-3 overflow-hidden rounded-2xl border border-line bg-paper shadow-card [&>li+li]:border-t [&>li+li]:border-line">
          {items.map((item, i) => (
            <li
              key={item.productId}
              draggable
              onDragStart={() => (dragFrom.current = i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragFrom.current !== null) move(dragFrom.current, i);
                dragFrom.current = null;
              }}
              className="flex items-start gap-3 px-4 py-3 sm:px-5"
            >
              <span className="mt-0.5 w-5 shrink-0 cursor-grab select-none text-muted" title="Drag to reorder" aria-hidden>
                ⠿
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-base leading-tight text-ink">{item.name}</span>
                {item.brand && <span className="text-xs uppercase tracking-[0.08em] text-muted">{item.brand}</span>}
                <input
                  defaultValue={item.note}
                  onBlur={(e) => saveNote(item.productId, e.target.value)}
                  placeholder="Add a note (optional)"
                  aria-label={`Note for ${item.name}`}
                  className="mt-1.5 w-full rounded-md border border-line bg-canvas px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-natural"
                />
              </span>
              <span className="flex shrink-0 flex-col items-center gap-0.5">
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move up" className="px-1 text-muted transition hover:text-ink disabled:opacity-30">
                  ↑
                </button>
                <button type="button" onClick={() => move(i, i + 1)} disabled={i === items.length - 1} aria-label="Move down" className="px-1 text-muted transition hover:text-ink disabled:opacity-30">
                  ↓
                </button>
              </span>
              <button type="button" onClick={() => removeProduct(item.productId)} aria-label={`Remove ${item.name}`} className="shrink-0 text-xs text-muted transition hover:text-processed">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
