"use client";

// Sign in / sign up / upgrade modal (Order G2). Functional and token-styled; D-G2 restyles
// later. House rule: friendly messages only, never raw errors.

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Modal } from "@/components/Modal";

export type AuthMode = "signin" | "signup" | "upgrade" | "reset";

function friendly(message: string | undefined, mode: AuthMode): string {
  const m = message ?? "";
  if (m.includes("Invalid login credentials")) return "That email and password don't match.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "That email already has an account — sign in instead.";
  if (m.toLowerCase().includes("password")) return "Passwords need at least 6 characters.";
  if (m.includes("Anonymous sign-ins are disabled"))
    return "Guest mode isn't switched on yet — use email for now.";
  if (m.includes("provider is not enabled") || m.includes("Unsupported provider"))
    return "Google sign-in isn't set up yet — use email for now.";
  return mode === "upgrade"
    ? "We couldn't save the account — try again."
    : "Something went wrong — try again.";
}

export function AuthModal({
  mode: initialMode,
  onClose,
  onDone,
}: {
  mode: AuthMode;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    const sb = supabaseBrowser();
    if (!sb || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "reset") {
        // Send the reset email. Route it through /auth/callback (which exchanges the PKCE code and
        // establishes a recovery session) then on to /auth/reset to set the new password. Same
        // emailRedirectTo reasoning as signup — the origin must also be on Supabase's Redirect URLs.
        const { error } = await sb.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
        });
        if (error) return setError(friendly(error.message, mode));
        // Neutral message either way — never reveal whether an email is registered.
        setNotice("If that email has an account, a reset link is on its way.");
        return;
      }
      if (mode === "signin") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) return setError(friendly(error.message, mode));
        onDone();
      } else if (mode === "signup") {
        // emailRedirectTo (S3): without it the confirmation link falls back to the project's Site
        // URL — which is how a production signup ends up mailing someone a localhost link. Pinning
        // it to THIS origin's /auth/callback means the link works from prod, a preview deploy or
        // local dev, and lands on the route that exchanges the PKCE code for a session.
        // Each origin must also be on Supabase's Redirect URLs allowlist.
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) return setError(friendly(error.message, mode));
        if (!data.session) {
          setNotice("Almost there — check your inbox to confirm your email.");
          return;
        }
        onDone();
      } else {
        // upgrade: attach email+password to the CURRENT (anonymous) user — same user id, so
        // everything already created as a guest survives. Same emailRedirectTo reasoning as signup:
        // the email-change confirmation must come back to this origin's callback, not the Site URL.
        const { error } = await sb.auth.updateUser(
          { email, password },
          { emailRedirectTo: `${window.location.origin}/auth/callback` },
        );
        if (error) return setError(friendly(error.message, mode));
        setNotice("Saved — if we sent you a confirmation email, click it to finish.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const sb = supabaseBrowser();
    if (!sb) return;
    setError(null);
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(friendly(error.message, mode));
  }

  async function guest() {
    const sb = supabaseBrowser();
    if (!sb || busy) return;
    setBusy(true);
    setError(null);
    const { error } = await sb.auth.signInAnonymously();
    setBusy(false);
    if (error) return setError(friendly(error.message, mode));
    onDone();
  }

  const title =
    mode === "signin"
      ? "Sign in"
      : mode === "signup"
        ? "Create your account"
        : mode === "reset"
          ? "Reset your password"
          : "Save your account";
  const cta = mode === "reset" ? "Send reset link" : title;

  return (
    <Modal onClose={onClose} labelledBy="auth-modal-title" panelClassName="max-w-sm p-6">
      <h2 id="auth-modal-title" className="font-display text-xl text-ink">
          {title}
        </h2>
        {mode === "upgrade" && (
          <p className="mt-1 text-sm text-muted">
            Keep everything you&apos;ve made as a guest — just add an email and password.
          </p>
        )}
        {mode === "reset" && (
          <p className="mt-1 text-sm text-muted">
            Enter your email and we&apos;ll send a link to set a new password.
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && mode === "reset") submit();
            }}
            placeholder="you@email.com"
            aria-label="Email"
            className="rounded-lg border border-line bg-canvas px-4 py-2.5 text-ink outline-none transition focus:border-natural focus:ring-2 focus:ring-natural/20"
          />
          {mode !== "reset" && (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="Password"
              aria-label="Password"
              className="rounded-lg border border-line bg-canvas px-4 py-2.5 text-ink outline-none transition focus:border-natural focus:ring-2 focus:ring-natural/20"
            />
          )}
          {mode === "signin" && (
            <button
              type="button"
              onClick={() => {
                setMode("reset");
                setError(null);
                setNotice(null);
              }}
              className="self-start text-sm text-muted underline decoration-line underline-offset-2 hover:text-ink"
            >
              Forgot password?
            </button>
          )}
          <button
            onClick={submit}
            disabled={busy || !email || (mode !== "reset" && !password)}
            className="mt-1 rounded-lg bg-ink px-5 py-2.5 font-medium text-paper transition hover:bg-ink/85 disabled:opacity-50"
          >
            {busy ? "One moment…" : cta}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-processed" role="alert">
            {error}
          </p>
        )}
        {notice && <p className="mt-3 text-sm text-natural">{notice}</p>}

        {mode === "reset" && (
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError(null);
              setNotice(null);
            }}
            className="mt-4 text-sm text-muted underline decoration-line underline-offset-2 hover:text-ink"
          >
            Back to sign in
          </button>
        )}

        {(mode === "signin" || mode === "signup") && (
          <>
            <button
              onClick={google}
              className="mt-3 w-full rounded-lg border border-line bg-paper px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-canvas"
            >
              Continue with Google
            </button>
            <div className="mt-4 flex items-center justify-between text-sm">
              {mode === "signin" ? (
                <button onClick={() => setMode("signup")} className="text-muted underline decoration-line underline-offset-2 hover:text-ink">
                  New here? Create an account
                </button>
              ) : (
                <button onClick={() => setMode("signin")} className="text-muted underline decoration-line underline-offset-2 hover:text-ink">
                  Have an account? Sign in
                </button>
              )}
              <button onClick={guest} className="text-muted underline decoration-line underline-offset-2 hover:text-ink">
                Continue without an account
              </button>
            </div>
          </>
        )}
    </Modal>
  );
}
