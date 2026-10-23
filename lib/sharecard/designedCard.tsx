// The DESIGNED share card (no product photo) — the always-accurate, free fallback for lists whose
// packshots the quality detector rejects (~half the catalogue) and the interim while a hero generates.
// This is Igor's suggestion #1 from the share-card thread: big title, the author, the product names as a
// clean numbered list, a quiet category motif — Spotify-playlist / Letterboxd-list energy. It carries NO
// product imagery, so it can never be wrong and has no rights risk; it renders for any list.
//
// Shares the editorial card's "Quiet Field Guide" tokens (Playfair headline, Caveat accent, Baloo 2
// wordmark, cream ground) so the two read as one system. Satori renders OUTSIDE Tailwind — every style is
// inline, colours literal. Fonts are loaded by the caller via loadCardFonts().
//
// v0 — the visual is a solid first draft for Kat (design) to refine; the category motif is intentionally
// minimal (one botanical sprig + a small per-category hook), not a full illustration set yet.

import React from "react";

const INK = "#2D2417";
const MUTED = "#766753";
const CREAM = "#F4EDE3";
const GREEN_DEEP = "#1C4A33";
const GREEN = "#2E7D52";
const LINE = "#E4D9C8";

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const monogram = (s: string) => (s.trim()[0] || "B").toUpperCase();

export type DesignedCardProps = {
  title: string;
  subtitle?: string | null; // small-caps rubric (tags / a short line)
  items: string[]; // product names, in list order
  ownerName?: string | null;
  handle?: string | null;
  productCount: number;
  cta?: string;
  /** How many product rows to show. Default 6 (the 4:5 feed); the 9:16 story passes more to fill. */
  maxRows?: number;
};

export function designedCard(p: DesignedCardProps) {
  const { title, subtitle, items, ownerName, handle, productCount, cta = "See the full list →", maxRows = 6 } = p;
  const who = ownerName ? `A list by ${ownerName.split(" ")[0]}` : "A Baloo list";
  const count = `${productCount} ${productCount === 1 ? "product" : "products"}`;
  const meta = handle ? `${count} · @${handle}` : count;
  const rows = items.filter(Boolean).slice(0, maxRows);
  const more = Math.max(0, productCount - rows.length);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: CREAM,
        fontFamily: "Inter",
        position: "relative",
      }}
    >
      {/* Quiet botanical sprig, bottom-right — the category motif placeholder (v0). */}
      <div style={{ position: "absolute", right: -40, bottom: 150, display: "flex", opacity: 0.1 }}>
        <svg width="460" height="460" viewBox="0 0 24 24" fill="none" stroke={GREEN_DEEP} strokeWidth="1">
          <path d="M12 21c0-6 0-12 5-17" strokeLinecap="round" />
          <path d="M12 16c-3-2-6-1-8-4 3-1 6 0 8 4z" fill={GREEN_DEEP} stroke="none" />
          <path d="M14 12c0-3 2-5 6-6-1 3-2 5-6 6z" fill={GREEN_DEEP} stroke="none" />
          <path d="M12 8c-2-2-2-5 0-7 2 2 2 5 0 7z" fill={GREEN_DEEP} stroke="none" />
        </svg>
      </div>

      {/* Header: serif headline + small-caps rubric, with the script accent top-right */}
      <div style={{ display: "flex", flexDirection: "column", padding: "62px 64px 0" }}>
        <div
          style={{
            display: "flex",
            fontFamily: "Playfair Display",
            fontWeight: 700,
            fontSize: title.length > 24 ? 78 : 92,
            lineHeight: 1.0,
            color: GREEN_DEEP,
            letterSpacing: -1,
            maxWidth: 640,
          }}
        >
          {clip(title, 42)}
        </div>
        {subtitle ? (
          <div
            style={{
              display: "flex",
              marginTop: 22,
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            {clip(subtitle, 40)}
          </div>
        ) : null}
      </div>

      {/* Script accent */}
      <div
        style={{
          position: "absolute",
          top: 70,
          right: 54,
          display: "flex",
          fontFamily: "Caveat",
          fontWeight: 700,
          fontSize: 58,
          lineHeight: 0.95,
          color: GREEN_DEEP,
          transform: "rotate(-7deg)",
          width: 250,
          justifyContent: "flex-end",
        }}
      >
        Good food goes further
      </div>

      {/* The products, as a clean numbered list (Letterboxd/Spotify energy) */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "48px 64px 0" }}>
        {rows.map((name, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 28,
              padding: "20px 0",
              borderTop: i === 0 ? `2px solid ${LINE}` : "none",
              borderBottom: `2px solid ${LINE}`,
            }}
          >
            <div
              style={{
                display: "flex",
                width: 52,
                fontFamily: "Playfair Display",
                fontWeight: 600,
                fontSize: 40,
                color: GREEN,
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </div>
            <div style={{ display: "flex", fontSize: 38, fontWeight: 600, color: INK }}>
              {clip(name, 34)}
            </div>
          </div>
        ))}
        {more > 0 ? (
          <div style={{ display: "flex", marginTop: 20, fontSize: 28, fontWeight: 600, color: MUTED }}>
            +{more} more
          </div>
        ) : null}
      </div>

      {/* Attribution + CTA */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 48px 30px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              width: 86,
              height: 86,
              borderRadius: 86,
              background: GREEN_DEEP,
              color: CREAM,
              fontFamily: "Baloo 2",
              fontWeight: 800,
              fontSize: 42,
              alignItems: "center",
              justifyContent: "center",
              border: "4px solid rgba(255,255,255,0.7)",
            }}
          >
            {monogram(ownerName || title)}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontFamily: "Playfair Display", fontWeight: 600, fontSize: 36, color: INK }}>
              {clip(who, 22)}
            </div>
            <div style={{ display: "flex", fontSize: 26, color: MUTED, marginTop: 2 }}>{clip(meta, 30)}</div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            background: INK,
            color: "#fff",
            borderRadius: 999,
            padding: "22px 34px",
            fontSize: 28,
            fontWeight: 600,
          }}
        >
          {cta}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "22px 64px 46px",
          background: CREAM,
          borderTop: `2px solid ${LINE}`,
        }}
      >
        <div style={{ display: "flex", fontFamily: "Baloo 2", fontWeight: 800, fontSize: 56, color: INK, letterSpacing: -1 }}>
          baloo
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: 2.5,
            textTransform: "uppercase",
            color: MUTED,
            textAlign: "right",
          }}
        >
          Find products worth remembering
        </div>
      </div>
    </div>
  );
}
