"use client";

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
  const [pending, setPending] = useState<Pending[]>([]); // OFF picks analysing in the background
  const [save, setSave] = useState<Save>("idle");
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
        const off: SearchHit[] = (data.off ?? []).map(
          (c: { barcode: string; name: string; brand: string | null }) => ({
            kind: "off" as const, id: "", name: c.name, brand: c.brand, slug: "", barcode: c.barcode,
          }),
        );
        setResults([...cat, ...off]); // catalog first — instant adds ahead of analyse-on-add
      } catch {
        setResults([]);
      }
      setSearched(true);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

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

  // Analyse one OFF pick in the background: /api/off/lookup runs the Claude pass once (or reuses a
  // known product), so it can take ~a minute. We don't block on it — the item sits in the list as an
  // "Analysing…" placeholder and resolves into a real product when it lands (idempotent on the server,
  // so a duplicate is harmless). On failure it flips to a "couldn't analyse" state with retry/dismiss.
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
        setPending((prev) => prev.filter((x) => x.barcode !== p.barcode));
        setItems((prev) =>
          prev.some((i) => i.productId === data.productId)
            ? prev
            : [...prev, { productId: data.productId, name: p.name, brand: p.brand, slug: data.slug, note: "" }],
        );
        setSave("saving");
        await fetch(`/api/lists/${listId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: data.productId }),
        }).catch(() => {});
        flashSaved();
      } catch {
        setPending((prev) => prev.map((x) => (x.barcode === p.barcode ? { ...x, status: "failed" } : x)));
      }
    },
    [listId, flashSaved],
  );

  // OFF candidate from the picker: queue it (non-blocking) and clear the search. The builder stays
  // usable and several picks can analyse at once.
  function addOffCandidate(hit: SearchHit) {
    if (pending.some((p) => p.barcode === hit.barcode && p.status === "analysing")) return;
    setPending((prev) => [
      ...prev.filter((p) => p.barcode !== hit.barcode),
      { barcode: hit.barcode, name: hit.name, brand: hit.brand, status: "analysing" },
    ]);
    setQ("");
    setResults([]);
    void resolveOff(hit);
  }

  function retryPending(p: Pending) {
    setPending((prev) => prev.map((x) => (x.barcode === p.barcode ? { ...x, status: "analysing" } : x)));
    void resolveOff(p);
  }

  function dismissPending(barcode: string) {
    setPending((prev) => prev.filter((p) => p.barcode !== barcode));
  }

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
