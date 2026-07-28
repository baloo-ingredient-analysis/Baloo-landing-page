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
            className="rounded-lg border border-line bg-paper px-3 py-2 text-center text-sm font-medium text-ink transition hover:bg-canvas"
          >
            {t.label}
          </a>
        ))}
        {/* Instagram isn't a plain intent link (no web share URL) — it saves the card + opens IG, or
            uses the native sheet on mobile. See instagram() above. */}
        <button
          type="button"
          onClick={instagram}
          className="rounded-lg border border-line bg-paper px-3 py-2 text-center text-sm font-medium text-ink transition hover:bg-canvas"
        >
          Instagram
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
