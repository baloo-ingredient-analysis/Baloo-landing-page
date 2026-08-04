"use client";

// Handle setup (Order G2) — the one step between "has an account" and "has an identity".
// Bounces straight home when the profile already exists. D-G2 restyles later.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/useAuth";
import { SiteHeader } from "@/components/SiteHeader";

const ERRORS: Record<string, string> = {
  invalid_handle: "Handles are 3–20 characters: lowercase letters, numbers and hyphens.",
  handle_reserved: "That handle is reserved — pick another.",
  handle_taken: "That handle's taken — try another.",
  auth_required: "You need to sign in first.",
};

export default function Welcome() {
  const { loading, available, user, profile, refresh } = useAuth();
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already set up (or auth not in play) → home.
  useEffect(() => {
    if (loading) return;
    if (!available || profile) router.replace("/");
  }, [loading, available, profile, router]);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, displayName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? ERRORS[data.error] ?? "Something went wrong — try again.");
        return;
      }
      refresh();
      router.replace("/");
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-tool flex-col px-5">
      <SiteHeader variant="center" showNav={false} />

      <section className="mx-auto mt-16 w-full max-w-sm animate-fade-in">
        {loading ? (
          <div className="flex justify-center">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-natural" aria-hidden />
          </div>
        ) : !user ? (
          <p className="text-center text-sm text-muted">
            Sign in first — head back to the homepage and tap &quot;Sign in&quot;.
          </p>
        ) : (
          <>
            <h1 className="font-display text-2xl text-ink">Pick your handle</h1>
            <p className="mt-1.5 text-sm text-muted">
              It&apos;s how your lists will be signed. You can change your display name anytime.
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <div className="flex items-center rounded-lg border border-line bg-canvas px-4 transition focus-within:border-natural focus-within:ring-2 focus-within:ring-natural/20">
                <span className="text-muted">@</span>
                <input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                  placeholder="your-handle"
                  aria-label="Handle"
                  className="flex-1 bg-transparent px-1.5 py-2.5 text-ink outline-none"
                />
              </div>
              <p className="px-1 text-xs text-muted">
                3–20 characters, lowercase letters, numbers and hyphens.
              </p>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display name (optional)"
                aria-label="Display name"
                className="rounded-lg border border-line bg-canvas px-4 py-2.5 text-ink outline-none transition focus:border-natural focus:ring-2 focus:ring-natural/20"
              />
              <button
                onClick={submit}
                disabled={busy || handle.length < 3}
                className="mt-1 rounded-lg bg-ink px-5 py-2.5 font-medium text-paper transition hover:bg-ink/85 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Continue"}
              </button>
            </div>

            {error && (
              <p className="mt-3 text-sm text-processed" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
}
