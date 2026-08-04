"use client";

// The homepage's one box, two intents (Order L1b — "search is the homepage"). Paste a supermarket
// URL → analyse (the existing tool flow); type anything else → search the community. Text search
// routes to /discover's keyword search today; L3 swaps in semantic search without touching this box.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { validateUrl, looksLikeUrl } from "@/lib/retailers";

export function HomeSearch({
  onAnalyze,
  busy,
}: {
  onAnalyze: (url: string) => void;
  busy: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isUrl = looksLikeUrl(value);
  const hasText = value.trim().length > 0;

  function submit() {
    const v = value.trim();
    if (!v) return;
    if (isUrl) {
      const check = validateUrl(v);
      if (!check.ok) {
        setError(check.reason);
        return;
      }
      setError(null);
      onAnalyze(v);
    } else {
      router.push(`/discover?q=${encodeURIComponent(v)}`);
    }
  }

  return (
    <div className="w-full max-w-xl">
      <div className="flex items-center gap-2 rounded-[18px] border border-line bg-paper p-1.5 pl-2 shadow-hero transition focus-within:border-natural/50 focus-within:ring-4 focus-within:ring-natural/10">
        {/* Intent chip — neutral, appears only once there's input. */}
        {hasText && (
          <span className="hidden shrink-0 rounded-full bg-canvas px-2.5 py-1 text-[11px] font-medium text-muted sm:inline">
            {isUrl ? "Product link" : "Search"}
          </span>
        )}
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Paste a product link — or ask, e.g. “kids cereals without junk”"
          aria-label="Paste a product link or search"
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[15px] text-ink outline-none placeholder:text-muted"
        />
        <button
          onClick={submit}
          disabled={busy}
          className="flex shrink-0 items-center justify-center gap-2 rounded-[13px] bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy && (
            <span
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-paper/40 border-t-paper"
              aria-hidden
            />
          )}
          {busy ? "Reading…" : isUrl || !hasText ? "Analyse" : "Search"}
        </button>
      </div>
      {error && (
        <p className="mt-2.5 text-center text-sm text-processed" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
