"use client";

// Create-a-list modal (Order PP3) — the Pinterest "Crear" step. Name the list + choose public/private,
// then Create. On success the caller closes this and drops the Pantry into selection mode to pick which
// saved products go in. Reuses the shared Modal shell (L1h) and createList via POST /api/lists.

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { useAuthGate } from "@/components/auth/useAuthGate";

export function CreateListModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (list: { id: string; slug: string; title: string }) => void;
}) {
  const { promptUpgrade } = useAuthGate();
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, isPublic }),
      });
      if (res.ok) {
        const data = await res.json();
        onCreated({ id: data.list.id, slug: data.list.slug, title: t });
      } else if (res.status === 403) {
        onClose();
        promptUpgrade();
      } else if (res.status === 409) {
        window.location.href = "/welcome"; // needs a handle first
      } else {
        setErr("We couldn't create that list. Try again.");
      }
    } catch {
      setErr("We couldn't create that list. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="create-list-title" panelClassName="max-w-md p-6">
      <h2 id="create-list-title" className="font-display text-xl text-ink">
        Create a list
      </h2>

      <label
        htmlFor="new-list-title"
        className="mt-5 block text-xs font-medium uppercase tracking-[0.1em] text-muted"
      >
        List name
      </label>
      <input
        id="new-list-title"
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") create();
        }}
        placeholder="e.g. Weeknight dinners"
        className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-[15px] text-ink outline-none transition focus:border-natural"
      />

      <div className="mt-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">Public list</p>
          <p className="mt-0.5 text-xs text-muted">
            Anyone can find and view it. Off keeps it private — just for you.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isPublic}
          aria-label="Public list"
          onClick={() => setIsPublic((v) => !v)}
          className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors ${
            isPublic ? "bg-ink" : "bg-line"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-paper shadow-card transition-transform ${
              isPublic ? "translate-x-[18px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {err && <p className="mt-3 text-sm text-processed">{err}</p>}

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-line bg-paper px-4 py-2 text-sm font-medium text-ink transition hover:border-ink/20"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={create}
          disabled={!title.trim() || busy}
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink/85 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create list"}
        </button>
      </div>
    </Modal>
  );
}
