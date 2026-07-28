"use client";

// Like (Order L8): the PUBLIC signal on a list — a warm rose-red heart with a live count. Reverses
// the L6 "Save is the one signal" rule for lists: Like is public and feeds Popular/Explore ranking,
// while Save (SavePill) stays private. Stored polymorphically as a vote (targetType "list") via the
// single POST-toggle /api/votes route. The heart is the one place the reserved `like` colour shows.

import { useState } from "react";
import { useAuthGate } from "@/components/auth/useAuthGate";

export function LikePill({
  listId,
  initialLiked,
  initialCount,
}: {
  listId: string;
  initialLiked: boolean;
  initialCount: number;
}) {
  const { available, ensureVerified, promptUpgrade, modal } = useAuthGate();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  if (!available) return null;

  async function toggle() {
    if (!ensureVerified()) return; // signed out → sign in; guest → upgrade prompt
    if (busy) return;
    setBusy(true);
    const next = !liked;
    setLiked(next); // optimistic
    setCount((c) => c + (next ? 1 : -1));
    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "list", targetId: listId }),
      });
      if (!res.ok) {
        setLiked(!next); // roll back
        setCount((c) => c + (next ? -1 : 1));
        if (res.status === 403) promptUpgrade();
      } else {
        const data = (await res.json()) as { voted: boolean; count: number };
        setLiked(data.voted); // reconcile with server truth
        setCount(data.count);
      }
    } catch {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={liked}
        aria-label={liked ? "Unlike this list" : "Like this list"}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium tabular-nums transition-colors duration-200 disabled:opacity-60 ${
          liked
            ? "border-like/40 bg-like-soft text-like"
            : "border-line bg-paper text-muted hover:border-ink/20 hover:text-ink"
        }`}
      >
        <svg
          viewBox="0 0 14 13"
          fill={liked ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
          aria-hidden
          className="h-3.5 w-3.5"
        >
          <path d="M7 12.1 1.6 6.9a3.2 3.2 0 0 1 4.5-4.5l.9.9.9-.9a3.2 3.2 0 1 1 4.5 4.5L7 12.1z" />
        </svg>
        {count > 0 ? count : "Like"}
      </button>
      {modal}
    </>
  );
}
