"use client";

// A public list's product rows (P5). Each row stays a real <Link> to the product page — so it's
// crawlable, and cmd/ctrl/middle-click still opens the full page in a new tab — but a plain left
// click is intercepted to open the quick-view drawer instead, keeping you in the list. No-JS falls
// back to normal navigation.

import { useState } from "react";
import Link from "next/link";
import { QuickView } from "@/components/product/QuickView";

type Row = { slug: string; name: string; brand: string | null; note: string | null };

export function ListItems({ items }: { items: Row[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <ul className="mt-8 overflow-hidden rounded-2xl border border-line bg-paper shadow-card [&>li+li]:border-t [&>li+li]:border-line">
        {items.map((item, i) => (
          <li key={`${item.slug}-${i}`}>
            <Link
              href={`/p/${item.slug}`}
              onClick={(e) => {
                // Let modified / non-primary clicks through (open in new tab, etc.).
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                setOpen(item.slug);
              }}
              className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-canvas sm:px-5"
            >
              <span className="w-6 shrink-0 font-display text-[15px] tabular-nums text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-base leading-tight text-ink">{item.name}</span>
                {item.brand && (
                  <span className="text-xs uppercase tracking-[0.08em] text-muted">{item.brand}</span>
                )}
                {item.note && <span className="mt-1 block text-sm text-muted">{item.note}</span>}
              </span>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-4 w-4 shrink-0 text-muted">
                <path d="M6 3.5L10.5 8 6 12.5" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
      <QuickView slug={open} onClose={() => setOpen(null)} />
    </>
  );
}
