"use client";

// Set-a-new-password page (Order S7c). The reset email links to /auth/callback?next=/auth/reset,
// so by the time we're here the PKCE code has been exchanged and the browser holds a short-lived
// RECOVERY session — enough to call updateUser({ password }) once, and nothing else. If someone
// lands here without that session (stale/opened-directly link), we say so plainly rather than show
// a form that can't work.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";

type State = "checking" | "ready" | "invalid" | "done";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [state, setState] = useState<State>("checking");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirm the recovery session exists before showing the form.
  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) {
      setState("invalid");
      return;
    }
    let live = true;
    sb.auth.getUser().then(({ data }) => {
      if (live) setState(data.user ? "ready" : "invalid");
    });
    return () => {
      live = false;
    };
  }, []);

  async function submit() {
    const sb = supabaseBrowser();
    if (!sb || busy) return;
    if (password.length < 6) {
      setError("Passwords need at least 6 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await sb.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError("That didn't work — the link may have expired. Request a new one from sign in.");
      return;
    }
    setState("done");
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1400);
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-tool flex-1 flex-col px-5 pt-8">
        <section className="mx-auto mt-16 w-full max-w-sm animate-fade-in">
          <h1 className="font-display text-2xl text-ink">Set a new password</h1>

          {state === "checking" && <p className="mt-3 text-sm text-muted">One moment…</p>}

          {state === "invalid" && (
            <div className="mt-4 rounded-2xl border border-line bg-paper p-6 shadow-card">
              <p className="text-sm text-ink">This reset link is invalid or has expired.</p>
              <p className="mt-1 text-sm text-muted">
                Head back and choose <span className="font-medium text-ink">Forgot password?</span> to
                get a fresh one.
              </p>
              <Link
                href="/"
                className="mt-4 inline-flex rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink/85"
              >
                Back to Baloo
              </Link>
            </div>
          )}

          {state === "ready" && (
            <div className="mt-4">
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                placeholder="New password"
                aria-label="New password"
                autoFocus
                className="w-full rounded-lg border border-line bg-canvas px-4 py-2.5 text-ink outline-none transition focus:border-natural focus:ring-2 focus:ring-natural/20"
              />
              {error && (
                <p className="mt-3 text-sm text-processed" role="alert">
                  {error}
                </p>
              )}
              <button
                onClick={submit}
                disabled={busy || !password}
                className="mt-3 w-full rounded-lg bg-ink px-5 py-2.5 font-medium text-paper transition hover:bg-ink/85 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save new password"}
              </button>
            </div>
          )}

          {state === "done" && (
            <div className="mt-4 rounded-2xl border border-line bg-paper p-6 shadow-card">
              <p className="text-sm text-ink">Password updated — you&rsquo;re signed in.</p>
              <p className="mt-1 text-sm text-muted">Taking you home…</p>
            </div>
          )}
        </section>

        <div className="mt-auto" />
      </main>
    </div>
  );
}
