// The WIDE editorial share card (1200×630, 1.91:1) — the link-unfurl sibling of editorialCard, behind
// every shared Baloo link (WhatsApp, Slack, iMessage, X, …), the broadest growth surface. Matches
// Jetain's approved landscape mockup: a left text column (wordmark, serif headline, author, CTA) and a
// right panel — the presented product photo when there is one (with the "Good food goes further" badge),
// or the product names as a clean numbered list when there isn't. Same "Quiet Field Guide" tokens as the
// portrait cards so the whole set reads as one system.
//
// Image follows the same ladder as the portrait card: an author cover or a clean generated hero fills the
// right panel; otherwise the no-photo list keeps it accurate and free. Satori renders OUTSIDE Tailwind —
// every style inline, colours literal. Fonts loaded by the caller via loadCardFonts().

import React from "react";

const INK = "#2D2417";
const MUTED = "#766753";
const CREAM = "#F4EDE3";
const GREEN_DEEP = "#1C4A33";
const GREEN = "#2E7D52";
const LINE = "#E4D9C8";

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const monogram = (s: string) => (s.trim()[0] || "B").toUpperCase();

export type WideCardProps = {
  title: string;
  subtitle?: string | null; // small-caps rubric (tags)
  heroUrl?: string | null; // author cover / generated hero; null → the no-photo numbered list
  items?: string[]; // product names (used only when heroUrl is null)
  ownerName?: string | null;
  handle?: string | null;
  productCount: number;
  cta?: string;
};

const MAX_ROWS = 4;

export function wideCard(p: WideCardProps) {
  const { title, subtitle, heroUrl, items = [], ownerName, handle, productCount, cta = "See the full list →" } = p;
  const who = ownerName ? `A list by ${ownerName.split(" ")[0]}` : "A Baloo list";
  const count = `${productCount} ${productCount === 1 ? "product" : "products"}`;
  const meta = handle ? `${count} · @${handle}` : count;
  const rows = items.filter(Boolean).slice(0, MAX_ROWS);
  const more = Math.max(0, productCount - rows.length);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: CREAM, fontFamily: "Inter" }}>
      {/* LEFT column — wordmark, headline, author, CTA */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: 560,
          padding: "46px 48px",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Baloo 2",
              fontWeight: 800,
              fontSize: 40,
              color: INK,
              letterSpacing: -1,
              marginBottom: 26,
            }}
          >
            baloo
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Playfair Display",
              fontWeight: 700,
              fontSize: title.length > 30 ? 54 : 64,
              lineHeight: 1.02,
              color: GREEN_DEEP,
              letterSpacing: -1,
            }}
          >
            {clip(title, 56)}
          </div>
          {subtitle ? (
            <div
              style={{
                display: "flex",
                marginTop: 16,
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: 2.5,
                textTransform: "uppercase",
                color: MUTED,
              }}
            >
              {clip(subtitle, 36)}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}>
            <div
              style={{
                display: "flex",
                width: 64,
                height: 64,
                borderRadius: 64,
                background: GREEN_DEEP,
                color: CREAM,
                fontFamily: "Baloo 2",
                fontWeight: 800,
                fontSize: 32,
                alignItems: "center",
                justifyContent: "center",
                border: "3px solid rgba(255,255,255,0.7)",
              }}
            >
              {monogram(ownerName || title)}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontFamily: "Playfair Display", fontWeight: 600, fontSize: 28, color: INK }}>
                {clip(who, 24)}
              </div>
              <div style={{ display: "flex", fontSize: 20, color: MUTED, marginTop: 2 }}>{clip(meta, 32)}</div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              background: INK,
              color: "#fff",
              borderRadius: 999,
              padding: "16px 28px",
              fontSize: 22,
              fontWeight: 600,
            }}
          >
            {cta}
          </div>
        </div>
      </div>

      {/* RIGHT panel — the hero photo, or the no-photo numbered list */}
      <div style={{ display: "flex", flex: 1, position: "relative" }}>
        {heroUrl ? (
          <>
            <img src={heroUrl} width={640} height={630} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {/* "Good food goes further" badge */}
            <div
              style={{
                position: "absolute",
                top: 40,
                right: 40,
                display: "flex",
                width: 150,
                height: 150,
                borderRadius: 150,
                background: "rgba(231,241,235,0.92)",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                fontFamily: "Caveat",
                fontWeight: 700,
                fontSize: 34,
                lineHeight: 0.95,
                color: GREEN_DEEP,
              }}
            >
              Good food goes further
            </div>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", width: "100%", padding: "50px 56px 46px", justifyContent: "center" }}>
            <div
              style={{
                display: "flex",
                marginBottom: 8,
                fontFamily: "Caveat",
                fontWeight: 700,
                fontSize: 40,
                color: GREEN_DEEP,
                transform: "rotate(-5deg)",
              }}
            >
              Good food goes further
            </div>
            {rows.map((name, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  padding: "16px 0",
                  borderBottom: `2px solid ${LINE}`,
                }}
              >
                <div style={{ display: "flex", width: 44, fontFamily: "Playfair Display", fontWeight: 600, fontSize: 30, color: GREEN }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: INK }}>{clip(name, 30)}</div>
              </div>
            ))}
            {more > 0 ? (
              <div style={{ display: "flex", marginTop: 16, fontSize: 22, fontWeight: 600, color: MUTED }}>+{more} more</div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
