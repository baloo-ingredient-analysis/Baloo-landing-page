"use client";

// Product quick-view (P5): peek a product's full ingredient breakdown in a slide-in drawer without
// leaving the list you're browsing. Opens when `slug` is set; fetches the stored analysis once and
// renders it through the SAME ResultsView the product page uses (tabs, ingredient rows, nutrition),
// with an "Open full page" escape hatch. Full-width sheet on mobile, right-hand drawer on desktop.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { CachedResult } from "@/lib/schema";
import { ResultsView } from "@/components/ResultsView";
import { Availability } from "./Availability";

type Payload = { slug: string; result: CachedResult; offers: { retailer: string | null; url: string | null }[] };

export function QuickView({ slug, onClose }: { slug: string | null; onClose: () => void }) {
  const [data, setData] = useState<Payload | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    if (!slug) return;
    setData(null);
    setState("loading");
    let live = true;
    fetch(`/api/products/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Payload) => {
        if (!live) return;
        setData(d);
        setState("ok");
      })
      .catch(() => live && setState("error"));
    return () => {
      live = false;
    };
  }, [slug]);

  // Lock body scroll + Escape-to-close while open.
  useEffect(() => {
    if (!slug) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [slug, onClose]);

  const stop = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  if (!slug) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex animate-fade-in justify-end bg-ink/30 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Product quick view"
    >
      <div
        onClick={stop}
        className="relative flex h-full w-full max-w-[480px] flex-col overflow-hidden bg-canvas shadow-hero"
      >
        {/* Sticky drawer bar: close + full-page link. */}
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-paper hover:text-ink"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden className="h-4 w-4">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
          <Link
            href={`/p/${slug}`}
            className="rounded-full border border-line bg-paper px-3.5 py-1.5 text-[13px] font-medium text-ink transition hover:border-ink/20"
          >
            Open full page
          </Link>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-10 [&>section]:mt-4">
          {state === "loading" && (
            <div className="flex h-40 items-center justify-center">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-natural" aria-hidden />
            </div>
          )}
          {state === "error" && (
            <p className="mt-10 text-center text-sm text-muted">
              We couldn&apos;t load this one.{" "}
              <Link href={`/p/${slug}`} className="text-ink underline underline-offset-2">
                Open the full page
              </Link>
              .
            </p>
          )}
          {state === "ok" && data && (
            <ResultsView
              productName={data.result.product_name}
              retailer={data.result.retailer}
              sourceUrl=""
              count={data.result.ingredients.length}
              ingredients={data.result.ingredients}
              nutrition={data.result.nutrition}
              productSummary={data.result.product_summary}
              loading={false}
              availability={<Availability base={data.result.retailer || null} offers={data.offers} />}
            />
          )}
        </div>
      </div>
    </div>
  );
}
