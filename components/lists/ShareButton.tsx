"use client";

// The Share affordance (Order G4, upgraded in L2). It used to call navigator.share({url}) and fall
// back to the clipboard — which on desktop, where navigator.share usually doesn't exist, silently
// meant "Link copied" with no channel choice. Now it opens the ShareSheet: channels, the card image,
// copy link, and the native OS sheet where the platform supports it.

import { useState } from "react";
import { ShareSheet } from "@/components/ShareSheet";

export function ShareButton({
  path,
  title = "Baloo",
  cardPath,
  igCardPath,
}: {
  path: string;
  title?: string;
  cardPath?: string; // landscape OG card (link unfurls + sheet preview); omit on surfaces without one
  igCardPath?: string; // portrait 4:5 Instagram card; the Instagram action + native share prefer it
}) {
  const [open, setOpen] = useState(false);
  const url = typeof window !== "undefined" ? window.location.origin + path : path;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-line bg-paper px-4 py-1.5 text-[13px] font-medium text-ink transition hover:border-ink/20"
      >
        Share
      </button>
      {open && (
        <ShareSheet
          url={url}
          title={title}
          cardPath={cardPath}
          igCardPath={igCardPath}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
