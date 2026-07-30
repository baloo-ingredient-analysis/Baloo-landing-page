"use client";

// The share sheet (Order L2) — Baloo's growth loop. Every public list and profile is meant to be
// distribution, so sharing needs a real channel choice, not just a clipboard fallback.
//
// Built on the L1h Modal shell, so Escape / backdrop-close / role="dialog" come for free.
//
// Two paths, by capability:
//   • Native (mobile): navigator.share with the card as a FILE -> the OS sheet, with Instagram in it.
//     This is the ~2-tap ceiling on the web; true one-tap IG Stories is native-only (backlog M1) and
//     must never be promised here.
//   • Everywhere else (desktop): per-channel intent URLs + copy link + save image.
// A surface without a card (profiles have no card yet) degrades to the link-only layout.

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { shareTargets } from "@/lib/share";

// Monochrome brand glyphs (currentColor) — recognisable but kept ink-neutral so the share sheet stays
// inside Baloo's restrained palette (no brand colours competing with the reserved N/P + Like hues).
const ic = "h-[18px] w-[18px] shrink-0";
const SHARE_ICONS: Record<string, React.ReactNode> = {
  whatsapp: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={ic}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.8 14.19c-.24.68-1.42 1.32-1.96 1.36-.5.05-.5.41-3.15-.66-2.66-1.07-4.3-3.79-4.43-3.97-.12-.18-1.05-1.4-1.05-2.66 0-1.27.66-1.9.9-2.16.24-.25.53-.31.7-.31l.5.01c.16 0 .38-.06.59.45.24.58.81 2.01.88 2.15.07.14.12.31.02.5-.09.18-.14.29-.28.45-.14.16-.29.36-.42.48-.14.14-.28.29-.12.57.16.28.72 1.19 1.55 1.93 1.06.95 1.96 1.24 2.24 1.38.28.14.44.12.6-.07.16-.19.69-.81.88-1.08.18-.28.37-.23.62-.14.25.09 1.6.75 1.87.89.28.14.46.21.53.32.07.12.07.68-.17 1.35z" />
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={ic}>
      <path d="M21.94 4.6l-3.02 14.26c-.22 1.01-.83 1.26-1.68.78l-4.63-3.41-2.24 2.15c-.25.25-.45.46-.93.46l.33-4.72 8.61-7.78c.37-.33-.08-.52-.58-.19L6.85 12.98l-4.58-1.43c-1-.31-1.02-1 .21-1.48l17.9-6.9c.83-.31 1.56.2 1.56 1.43z" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={ic}>
      <path d="M17.53 3h3.02l-6.6 7.54L21.75 21h-6.06l-4.75-6.2L5.5 21H2.47l7.06-8.07L2.25 3h6.21l4.29 5.67zm-1.06 16.2h1.67L7.6 4.71H5.8z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={ic}>
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.78-3.9 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden className={ic}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  ),
};

export function ShareSheet({
  url,
  title,
  cardPath,
  onClose,
}: {
  url: string; // absolute
  title: string;
  cardPath?: string; // e.g. /api/og/list/[slug] — omitted when the surface has no card
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const text = `${title} — on Baloo`;
  const targets = shareTargets({ url, text });
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the link is on screen to copy by hand */
    }
  }

  // Share the CARD, not just the link, when the platform allows files — that's what makes the OS
  // sheet offer Instagram. Falls back to a URL share, then quietly does nothing if the user cancels.
  async function nativeShare() {
    if (busy) return;
    setBusy(true);
    try {
      if (cardPath) {
        try {
          const res = await fetch(cardPath);
          const blob = await res.blob();
          const file = new File([blob], "baloo-card.png", { type: blob.type || "image/png" });
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], text, url });
            return;
          }
        } catch {
          /* card fetch/File unsupported — fall through to the link share */
        }
      }
      await navigator.share({ title, text, url });
    } catch {
      /* user dismissed the sheet */
    } finally {
      setBusy(false);
    }
  }

  // Instagram has NO web "share this link" endpoint like WhatsApp/X/etc., and it's image-first — you
  // can't prefill a post from the browser. So we do the best real thing: on mobile, the native share
  // sheet (with the card image) lists Instagram; on desktop, save the card and open Instagram to post.
  async function instagram() {
    if (canNativeShare && cardPath) return nativeShare();
    if (cardPath) {
      try {
        const a = document.createElement("a");
        a.href = cardPath;
        a.download = "baloo-card.png";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setNote("Card image saved — open Instagram and post it.");
        setTimeout(() => setNote(null), 4000);
      } catch {
        /* download blocked — still open Instagram below */
      }
    } else {
      copy(); // no card (e.g. a profile) → put the link on the clipboard to paste into IG
      setNote("Link copied — paste it into your Instagram bio or a DM.");
      setTimeout(() => setNote(null), 4000);
    }
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  }

  return (
    <Modal onClose={onClose} labelledBy="share-sheet-title" panelClassName="max-w-sm p-5">
      <h2 id="share-sheet-title" className="font-display text-xl text-ink">
        Share
      </h2>
      <p className="mt-1 text-sm text-muted">Send this to someone who&rsquo;d find it useful.</p>

      {cardPath && (
        // eslint-disable-next-line @next/next/no-img-element -- generated OG card, not a static asset
        <img
          src={cardPath}
          alt=""
          className="mt-4 w-full rounded-xl border border-line"
          loading="lazy"
        />
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {targets.map((t) => (
          <a
            key={t.id}
            href={t.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg border border-line bg-paper px-3 py-2 text-sm font-medium text-ink transition hover:bg-canvas"
          >
            <span>{t.label}</span>
            {SHARE_ICONS[t.id]}
          </a>
        ))}
        {/* Instagram isn't a plain intent link (no web share URL) — it saves the card + opens IG, or
            uses the native sheet on mobile. See instagram() above. */}
        <button
          type="button"
          onClick={instagram}
          className="flex items-center justify-center gap-2 rounded-lg border border-line bg-paper px-3 py-2 text-sm font-medium text-ink transition hover:bg-canvas"
        >
          <span>Instagram</span>
          {SHARE_ICONS.instagram}
        </button>
      </div>

      {note && <p className="mt-2 text-xs text-muted">{note}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className="flex-1 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink/85"
        >
          {copied ? "Link copied" : "Copy link"}
        </button>
        {canNativeShare && (
          <button
            type="button"
            onClick={nativeShare}
            disabled={busy}
            className="flex-1 rounded-lg border border-line bg-paper px-4 py-2 text-sm font-medium text-ink transition hover:bg-canvas disabled:opacity-60"
          >
            {busy ? "Opening…" : "Share…"}
          </button>
        )}
      </div>

      {cardPath && (
        <a
          href={cardPath}
          download="baloo-card.png"
          className="mt-3 block text-center text-xs text-muted underline decoration-line underline-offset-2 transition hover:text-ink"
        >
          Save image
        </a>
      )}
    </Modal>
  );
}
