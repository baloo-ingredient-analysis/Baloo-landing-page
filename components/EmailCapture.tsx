"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/context";

export function EmailCapture() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || busy) return;
    setBusy(true);
    try {
      await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setDone(true);
    } catch {
      // Email capture is best-effort; still confirm to the user.
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-12 rounded-2xl border border-natural/30 bg-natural-soft/60 p-6 text-center animate-fade-in">
        <p className="font-medium text-natural">{t.email.doneTitle}</p>
        <p className="mt-1 text-sm text-muted">{t.email.doneSub}</p>
      </div>
    );
  }

  return (
    <div className="mt-12 rounded-2xl border border-line bg-paper p-6 text-center shadow-card sm:p-8">
      <h2 className="font-display text-xl text-ink">{t.email.heading}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">{t.email.body}</p>
      <div className="mx-auto mt-5 flex max-w-sm flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="you@email.com"
          aria-label={t.email.ariaLabel}
          className="flex-1 rounded-lg border border-line bg-canvas px-4 py-2.5 text-ink outline-none transition focus:border-natural focus:ring-2 focus:ring-natural/20"
        />
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-lg bg-natural px-5 py-2.5 font-medium text-paper transition hover:bg-natural/90 disabled:opacity-50"
        >
          {t.email.notify}
        </button>
      </div>
      <p className="mt-3 text-xs text-muted">{t.email.noSpam}</p>
    </div>
  );
}
