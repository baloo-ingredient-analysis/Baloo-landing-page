"use client";

// The Lists tab (Order PP2) — the profile's lists, UNIFIED: your own created lists AND lists you've
// saved from others, shown the same way (Pinterest-style). A visitor sees only public created lists
// (saved lists are private). Client so the Latest / Most popular filter re-sorts without a round-trip.

import { useMemo, useState } from "react";
import Link from "next/link";
import { ListCard } from "@/components/lists/ListCard";
import type { ListWithCountsAndOwner } from "@/lib/db/queries/lists";

type Sort = "latest" | "popular";

export function ProfileLists({
  lists,
  isOwner,
}: {
  lists: ListWithCountsAndOwner[];
  isOwner: boolean;
}) {
  const [sort, setSort] = useState<Sort>("latest");
  const shown = useMemo(() => {
    const copy = [...lists];
    copy.sort((a, b) =>
      sort === "popular"
        ? b.likeCount - a.likeCount || +new Date(b.updatedAt) - +new Date(a.updatedAt)
        : +new Date(b.updatedAt) - +new Date(a.updatedAt),
    );
    return copy;
  }, [lists, sort]);

  if (lists.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-line bg-paper p-8 text-center shadow-card">
        <p className="font-display text-lg text-ink">No lists yet</p>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">
          {isOwner
            ? "Make your first list — publish it and your profile joins the community."
            : "This person hasn’t published any lists yet."}
        </p>
        {isOwner && (
          <Link
            href="/lists/new"
            className="mt-4 inline-flex rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink/85"
          >
            New list
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex gap-1 rounded-full bg-canvas p-1 text-[13px] font-medium" role="tablist" aria-label="Sort lists">
        {(["latest", "popular"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={sort === s}
            onClick={() => setSort(s)}
            className={`rounded-full px-3 py-1 transition ${
              sort === s ? "bg-paper text-ink shadow-card" : "text-muted hover:text-ink"
            }`}
          >
            {s === "latest" ? "Latest" : "Most popular"}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {shown.map((l) => (
          <ListCard key={l.id} list={l} handle={l.ownerHandle} />
        ))}
      </div>
    </div>
  );
}
