"use client";

// The app-shell search (Order L1d-2) — "search is the homepage" made reachable from every page. A
// compact trigger in the sticky bar opens a dual-intent overlay: paste a supermarket URL → the
// homepage analyse flow (navigate to `/?url=…`, which auto-runs on mount); type anything else →
// the community search (`/discover?q=…`). Hidden on "/" itself, where the hero box already is.
//
// The overlay mirrors AuthModal (fixed inset-0, ink scrim, Escape + backdrop close). Press "/" from
// anywhere to open it. Text search routes to /discover's keyword search today; L3 swaps in semantic
// search without touching this.

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { validateUrl, looksLikeUrl } from "@/lib/retailers";
import { Modal } from "@/components/Modal";

export function HeaderSearch() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);

  // Global "/" shortcut to open — ignored while typing in a field so it doesn't hijack input.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      const typing =
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      setOpen(true);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // The homepage carries the hero box; don't double up.
  if (pathname === "/") return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search or paste a product link"
        className="flex items-center gap-2 rounded-full border border-line bg-paper py-1.5 pl-2.5 pr-3 text-[13px] font-medium text-muted transition hover:border-ink/20 hover:text-ink"
      >
        <SearchIcon />
        <span className="hidden sm:inline">Search</span>
      </button>
      {open && <SearchOverlay onClose={() => setOpen(false)} />}
    </>
  );
}

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isUrl = looksLikeUrl(value);
  const hasText = value.trim().length > 0;

  // Escape + backdrop close live in the shared Modal shell (L1h); this just takes focus.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit() {
    const v = value.trim();
    if (!v) return;
    if (isUrl) {
      const check = validateUrl(v);
      if (!check.ok) {
        setError(check.reason);
        return;
      }
      // Hand off to the homepage's analyse flow — it reads ?url= on mount and streams the result.
      router.push(`/?url=${encodeURIComponent(v)}`);
    } else {
      router.push(`/discover?q=${encodeURIComponent(v)}`);
    }
    onClose();
  }

  return (
    <Modal onClose={onClose} align="top" panelClassName="max-w-xl p-4" label="Search or paste a product link">
      <div className="flex items-center gap-2 rounded-[14px] border border-line bg-canvas p-1.5 pl-2.5 transition focus-within:border-natural/50 focus-within:ring-4 focus-within:ring-natural/10">
          {hasText && (
            <span className="hidden shrink-0 rounded-full bg-paper px-2.5 py-1 text-[11px] font-medium text-muted sm:inline">
              {isUrl ? "Product link" : "Search"}
            </span>
          )}
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Paste a product link — or ask, e.g. “kids cereals without junk”"
            aria-label="Search or paste a product link"
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[15px] text-ink outline-none placeholder:text-muted"
          />
          <button
            onClick={submit}
            className="shrink-0 rounded-[11px] bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink/85"
          >
            {isUrl || !hasText ? "Analyse" : "Search"}
          </button>
        </div>
        {error ? (
          <p className="mt-2.5 px-1 text-sm text-processed" role="alert">
            {error}
          </p>
        ) : (
          <p className="mt-2.5 px-1 text-xs text-muted">
            Paste a supermarket link to analyse it, or describe what you&rsquo;re after to search lists.
          </p>
        )}
    </Modal>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-4 w-4"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  );
}
