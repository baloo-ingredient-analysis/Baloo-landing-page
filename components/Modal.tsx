"use client";

// The shared modal shell (Order L1h) — one dialog idiom for every overlay in the app (auth, the
// header search, report). Before this, the three had drifted: one was missing Escape, one closed on
// a fragile click-with-stopPropagation, and none announced themselves as dialogs.
//
// Backdrop close uses onMouseDown + a target check rather than onClick: a click handler fires when
// you press INSIDE the panel and release on the backdrop (e.g. dragging to select text), which
// closes the dialog out from under the user. Comparing the mousedown target avoids that.

import { useEffect } from "react";

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
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Two layers so a tall dialog is always reachable: the OUTER layer is the full-viewport scroll
  // container (overflow-y-auto), the INNER flex has `min-h-full` so short dialogs stay centered while
  // a dialog taller than the viewport grows the scroll area instead of clipping its top off-screen
  // (the bug this fixes: a long form's email/password fields ending up above the viewport, unreachable).
  return (
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
    </div>
  );
}
