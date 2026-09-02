"use client";

// The interactive half of /settings (Order S7a; L5b adds username change). Kept as a small island so
// the page itself stays a server component.

import { useState } from "react";
import { DeleteAccountDialog } from "@/components/account/DeleteAccountDialog";
import { profilePath } from "@/lib/profilePath";

const ERRORS: Record<string, string> = {
  invalid_handle: "Handles are 3–20 characters: lowercase letters, numbers and hyphens.",
  handle_reserved: "That handle is reserved — pick another.",
  handle_taken: "That handle's taken — try another.",
};

export function SettingsClient({ handle }: { handle: string }) {
  const [confirming, setConfirming] = useState(false);
  const [value, setValue] = useState(handle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = value.trim().toLowerCase();
  const changed = next !== handle && next.length > 0;

  async function save() {
    if (busy || !changed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? ERRORS[data.error] ?? "Something went wrong — try again.");
        return;
      }
      // Full navigation to the new profile so the session + header pick up the new handle.
      window.location.assign(profilePath(data.profile?.handle ?? next));
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mt-8 rounded-2xl border border-line bg-paper p-5 shadow-card">
        <h2 className="font-display text-lg text-ink">Username</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Your profile lives at <span className="text-ink">baloo.life/@{handle}</span>. Change it and
          your old link keeps working — it redirects to the new one.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center rounded-lg border border-line bg-canvas px-3 transition focus-within:border-natural focus-within:ring-2 focus-within:ring-natural/20">
            <span className="text-muted">@</span>
            <input
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              aria-label="Username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-transparent px-1.5 py-2 text-ink outline-none"
            />
          </div>
          <button
            type="button"
            onClick={save}
            disabled={!changed || busy}
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink/85 disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-processed">{error}</p>}
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-paper p-5 shadow-card">
        <h2 className="font-display text-lg text-ink">Delete account</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Deletes your email, profile, private lists, saves and follows, and clears the text of your
          comments. Public lists you made stay, without your name on them, so links other people
          saved keep working.
        </p>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 rounded-full border border-line bg-paper px-4 py-2 text-sm font-medium text-ink transition hover:border-ink/20"
        >
          Delete account…
        </button>
      </div>

      {confirming && <DeleteAccountDialog handle={handle} onClose={() => setConfirming(false)} />}
    </>
  );
}
