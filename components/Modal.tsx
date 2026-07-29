"use client";

// The shared modal shell (Order L1h) — one dialog idiom for every overlay in the app (auth, the
// header search, report, create-list, share).
//
// PORTAL TO document.body (fix): the modal is triggered from places like the sticky header, which uses
// `backdrop-blur`. A `backdrop-filter` (or `transform`/`filter`) ancestor becomes the containing block
// for `position: fixed` descendants — so a modal rendered inside the header was being sized/clipped to
// the 56px header box and trapped in its stacking context (it showed as a sliver behind the page).
// Rendering into <body> via a portal makes `fixed inset-0` relative to the viewport again, everywhere.
//
// Layering: an outer `overflow-y-auto` scroll container + an inner `min-h-full` flex — short dialogs
// center, a dialog taller than the viewport scrolls instead of clipping its top off-screen.
//
// Backdrop close uses onMouseDown + a target check rather than onClick: a click handler fires when you
// press INSIDE the panel and release on the backdrop (e.g. dragging to select text), which would close
// the dialog out from under the user. Comparing the mousedown target avoids that.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function Modal({
  onClose,
  children,
  align = "center",
  panelClassName = "max-w-sm p-6",
  labelledBy,
  label,
}: {
  onClose: () => void;
  children: React.ReactNode;
  align?: "center" | "top"; // "top" for the search palette; "center" for everything else
  panelClassName?: string; // per-dialog width + padding
  labelledBy?: string; // id of the dialog's heading (preferred)
  label?: string; // fallback when there's no visible heading
}) {
  // Portals need the DOM; render nothing on the server / first paint to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/20">
      <div
        className={`flex min-h-full justify-center p-5 ${
          align === "top" ? "items-start pt-[12vh]" : "items-center"
        }`}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-label={label}
          className={`w-full animate-rise rounded-2xl border border-line bg-paper shadow-hero ${panelClassName}`}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
