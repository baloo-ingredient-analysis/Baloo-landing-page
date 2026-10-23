// The V2 editorial share card (the Jetain mockup) — rendered by Satori (next/og). A warm "Quiet Field
// Guide" layout: a Playfair serif headline + a Caveat script accent on cream, the generated product
// hero filling the lower half, the curator's attribution and a CTA over a soft scrim, and the baloo
// wordmark footer. Satori renders OUTSIDE Tailwind, so every style is inline and colours are literal.
// Fonts (Playfair Display, Inter, Caveat, Baloo 2) are loaded by the caller via loadCardFonts().
//
// 4:5 (1080×1350) is the Instagram feed asset; the 9:16 story and 1.91:1 unfurl are follow-ups.

import React from "react";

const INK = "#2D2417";
const MUTED = "#766753";
const CREAM = "#F4EDE3";
const PAPER = "#FDFAF6";
const GREEN_DEEP = "#1C4A33";
const GREEN = "#2E7D52";
const LINE = "#E4D9C8";

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const monogram = (s: string) => (s.trim()[0] || "B").toUpperCase();

export type EditorialCardProps = {
  title: string;
  subtitle?: string | null; // small-caps rubric (tags, or a short line)
  heroUrl?: string | null; // the generated product hero; null → a soft cream panel
  ownerName?: string | null; // "Lena Kowalska"
  handle?: string | null; // "lenasnacks"
  productCount: number;
  cta?: string;
};

export function editorialCard(p: EditorialCardProps) {
  const { title, subtitle, heroUrl, ownerName, handle, productCount, cta = "See the full list →" } = p;
  const who = ownerName ? `A list by ${ownerName.split(" ")[0]}` : "A Baloo list";
  const count = `${productCount} ${productCount === 1 ? "product" : "products"}`;
  const meta = handle ? `${count} · @${handle}` : count;

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

      {/* Hero */}
      <div style={{ display: "flex", flex: 1, position: "relative", marginTop: 34 }}>
        {heroUrl ? (
          <img src={heroUrl} width={1080} height={820} style={{ width: 1080, height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ display: "flex", width: "100%", height: "100%", background: PAPER }} />
        )}
        {/* Attribution + CTA over a cream scrim */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: 1080,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            padding: "0 48px 34px",
            background: `linear-gradient(to top, ${CREAM} 12%, rgba(244,237,227,0.86) 46%, rgba(244,237,227,0) 100%)`,
            height: 300,
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
