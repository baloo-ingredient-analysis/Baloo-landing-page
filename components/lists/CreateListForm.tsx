"use client";

import { useState } from "react";
import { useLocalizedRouter } from "@/lib/i18n/useLocalizedRouter";

// /lists/new (Order G4): name the list, create it, go straight to the editor where products get
// added. Kept minimal — the editor is the rich surface.
export function CreateListForm() {
  const router = useLocalizedRouter();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === "needs_handle"
            ? "Choose a handle first (top-right menu)."
            : "We couldn't create the list — try again.",
        );
        return;
      }
      router.push(`/list/${data.list.slug}/edit`);
    } catch {
      setError("We couldn't create the list — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 max-w-md">
      <label className="block text-sm text-muted" htmlFor="list-title">
        List title
      </label>
      <input
        id="list-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") create();
        }}
        placeholder="Best supermarket cereals"
        className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-4 py-2.5 text-ink outline-none transition focus:border-natural focus:ring-2 focus:ring-natural/20"
      />
      <button
        onClick={create}
        disabled={busy || !title.trim()}
        className="mt-3 rounded-lg bg-ink px-5 py-2.5 font-medium text-paper transition hover:bg-ink/85 disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create list"}
      </button>
      {error && (
        <p className="mt-3 text-sm text-processed" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
