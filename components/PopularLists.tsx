"use client";

// Homepage "Popular lists this week" strip (Order L1b) — the "lists are the homepage" strategy made
// visible. Load-time fetch of /api/popular (saves-only signal, L6); renders nothing when there's no
// signal — real numbers only, never a faked ranking. Mirrors <Board>'s idle-only, no-polling pattern.

import { useEffect, useState } from "react";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import { ListCard } from "@/components/lists/ListCard";
import { useT } from "@/lib/i18n/context";
import type { ListWithCountsAndOwner } from "@/lib/db/queries/lists";

export function PopularLists() {
  const t = useT();
  const [lists, setLists] = useState<ListWithCountsAndOwner[] | null>(null);

  useEffect(() => {
    let live = true;
    // no-store on the client so a fresh save shows without waiting out the route's edge cache
    // (the route keeps s-maxage=60 for Vercel's CDN across users).
    fetch("/api/popular", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => live && setLists(d.lists ?? []))
      .catch(() => live && setLists([]));
    return () => {
      live = false;
    };
  }, []);

  // Nothing to show (still loading, or no signal) → render nothing; the homepage stays tool-first.
  if (!lists || lists.length === 0) return null;

  return (
    <section className="mt-16 animate-fade-in sm:mt-20">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-[23px] text-ink">{t.popular.heading}</h2>
        <LocalizedLink href="/discover" className="shrink-0 text-sm font-medium text-natural hover:underline">
          {t.popular.browseAll}
        </LocalizedLink>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lists.map((l) => (
          <ListCard key={l.id} list={l} handle={l.ownerHandle} />
        ))}
      </div>
    </section>
  );
}
