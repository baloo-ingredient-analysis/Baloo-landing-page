"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthGate } from "@/components/auth/useAuthGate";

type MyList = { id: string; slug: string; title: string; isPublic: boolean; itemCount: number };

// The product page → lists connector (Order G4). Signed out → sign-in modal; signed in → a
// popover of your lists (add with one tap) plus inline "new list". Renders nothing until Supabase
// is configured.
export function AddToList({ productId }: { productId: string }) {
  const { available, user, profile, ensureVerified, promptUpgrade, modal } = useAuthGate();
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<MyList[] | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function loadLists() {
    setLists(null);
    try {
      const res = await fetch("/api/lists");
      const data = await res.json();
      setLists(data.lists ?? []);
    } catch {
      setLists([]);
    }
  }

  async function openPicker() {
    if (!ensureVerified()) return; // signed out → sign in; guest → upgrade prompt
    if (!profile) {
      window.location.href = "/welcome";
      return;
    }
    setOpen(true);
    loadLists();
  }

  function unmark(listId: string) {
    setAdded((s) => {
      const n = new Set(s);
      n.delete(listId);
      return n;
    });
  }

  async function add(listId: string) {
    setAdded((s) => new Set(s).add(listId)); // optimistic
    try {
      const res = await fetch(`/api/lists/${listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (!res.ok) {
        unmark(listId);
        if (res.status === 403) promptUpgrade();
      }
    } catch {
      unmark(listId);
    }
  }

  async function createAndAdd() {
    if (!newTitle.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        const data = await res.json();
        await add(data.list.id);
        setNewTitle("");
        await loadLists();
      } else if (res.status === 403) {
        promptUpgrade();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!available) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={openPicker}
        className="rounded-full bg-ink px-4 py-1.5 text-[13px] font-medium text-paper transition hover:bg-ink/85"
      >
        Add to my list
      </button>

      {open && user && (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-line bg-paper p-2 shadow-hero">
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
            Add to list
          </p>
          {lists === null ? (
            <p className="px-2 py-2 text-sm text-muted">Loading…</p>
          ) : (
            <>
              {lists.length > 0 && (
                <ul className="max-h-56 overflow-auto">
                  {lists.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => add(l.id)}
                        disabled={added.has(l.id)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-canvas disabled:opacity-60"
                      >
                        <span className="min-w-0 truncate text-sm text-ink">{l.title}</span>
                        <span className="shrink-0 text-xs text-muted">
                          {added.has(l.id) ? "✓ Added" : "Add"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-1 border-t border-line pt-2">
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createAndAdd();
                  }}
                  placeholder="New list name…"
                  aria-label="New list name"
                  className="w-full rounded-md border border-line bg-canvas px-2.5 py-1.5 text-sm text-ink outline-none focus:border-natural"
                />
                <button
                  type="button"
                  onClick={createAndAdd}
                  disabled={busy || !newTitle.trim()}
                  className="mt-1.5 w-full rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper transition hover:bg-ink/85 disabled:opacity-50"
                >
                  {busy ? "Adding…" : "Create & add"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {modal}
    </div>
  );
}
