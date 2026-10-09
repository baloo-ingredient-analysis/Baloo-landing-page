"use client";

// Delete-account confirmation (Order S7a). Irreversible, so the dialog does three things:
// says plainly what survives and what doesn't, requires the handle typed exactly (no muscle-memory
// "Confirm"), and only then enables the destructive button.

import { useState } from "react";
import { useLocalizedRouter } from "@/lib/i18n/useLocalizedRouter";
import { Modal } from "@/components/Modal";
import { supabaseBrowser } from "@/lib/supabase/client";

export function DeleteAccountDialog({ handle, onClose }: { handle: string; onClose: () => void }) {
  const router = useLocalizedRouter();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = typed.trim().toLowerCase() === handle.toLowerCase();

  async function destroy() {
    if (!confirmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        setError("We couldn't delete the account just now — try again in a moment.");
        return;
      }
      // The auth user is gone; drop the local session so the UI doesn't keep a dead one around.
      await supabaseBrowser()?.auth.signOut();
      router.push("/");
      router.refresh();
    } catch {
      setError("We couldn't delete the account just now — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="delete-account-title" panelClassName="max-w-md p-6">
      <h2 id="delete-account-title" className="font-display text-xl text-ink">
        Delete your account
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        This can&rsquo;t be undone. Your email, profile and private lists are deleted, along with your
        saves, follows and comment text.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        <span className="font-medium text-ink">Your public lists stay</span>, without your name on
        them — so the links other people saved keep working.
      </p>

      <label className="mt-5 block text-sm text-ink">
        Type <span className="font-medium">@{handle}</span> to confirm
        <input
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value);
            if (error) setError(null);
          }}
          autoComplete="off"
          aria-label={`Type @${handle} to confirm deletion`}
          className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-4 py-2.5 text-ink outline-none transition focus:border-natural focus:ring-2 focus:ring-natural/20"
        />
      </label>

      {error && (
        <p className="mt-3 text-sm text-processed" role="alert">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3.5 py-2 text-sm font-medium text-muted transition hover:text-ink"
        >
          Keep my account
        </button>
        {/* Ink, not a danger colour: `processed` is classification, never a control (DESIGN.md), and
            the system has no red. The typed-handle gate + explicit copy carry the weight instead. */}
        <button
          type="button"
          onClick={destroy}
          disabled={!confirmed || busy}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Deleting…" : "Delete account"}
        </button>
      </div>
    </Modal>
  );
}
