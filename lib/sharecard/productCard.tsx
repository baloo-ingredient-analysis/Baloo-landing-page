// The editorial PRODUCT share card (4:5, 1080×1350) — the Quiet Field Guide sibling of the list cards,
// for a single product. Unlike a list, a product's value is the ingredient breakdown, so this card
// foregrounds the ingredients with their Natural/Processed pill — the one meaningful colour, never a
// score — which is the one thing a link unfurl can't show. It is photo-free by design: the ingredient
// data is text we own, so the card is ALWAYS accurate and carries no image-rights risk (exactly Igor's
// concern), and it renders for every product.
//
// Shares the list cards' tokens (Playfair headline, Caveat accent, Baloo 2 wordmark, cream ground) so the
// set reads as one system. Satori renders OUTSIDE Tailwind — styles inline, colours literal. Fonts are
// loaded by the caller via loadCardFonts().

import React from "react";

const INK = "#2D2417";
const MUTED = "#766753";
const CREAM = "#F4EDE3";
const GREEN_DEEP = "#1C4A33";
const GREEN = "#2E7D52";
const LINE = "#E4D9C8";
const NAT_SOFT = "#E7F1EB";
const PROC = "#B5701F";
const PROC_SOFT = "#F6ECDD";

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export type ProductCardRow = { name: string; tag?: "Natural" | "Processed" | null };

export type ProductCardProps = {
  name: string;
  brand?: string | null;
  items: ProductCardRow[];
  ingredientCount: number;
  cta?: string;
  /** How many ingredient rows to show. Default 6 (the 4:5 feed); a 9:16 story passes more. */
  maxRows?: number;
};

export function productCard(p: ProductCardProps) {
  const { name, brand, items, ingredientCount, cta = "See the full breakdown →", maxRows = 6 } = p;
  const rows = items.filter((r) => r.name).slice(0, maxRows);
  const more = Math.max(0, ingredientCount - rows.length);
  const sub = `${ingredientCount} ${ingredientCount === 1 ? "ingredient" : "ingredients"}, explained`;

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
      {/* Header: brand eyebrow + product name, with the script accent top-right */}
      <div style={{ display: "flex", flexDirection: "column", padding: "62px 64px 0" }}>
        {brand ? (
          <div
            style={{
              display: "flex",
              marginBottom: 14,
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            {clip(brand, 30)}
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            fontFamily: "Playfair Display",
            fontWeight: 700,
            fontSize: name.length > 24 ? 74 : 88,
            lineHeight: 1.0,
            color: GREEN_DEEP,
            letterSpacing: -1,
            maxWidth: 680,
          }}
        >
          {clip(name, 46)}
        </div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 28, color: MUTED }}>{sub}</div>
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

      {/* Ingredients with the Natural/Processed pill — the card's reason to exist */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "44px 64px 0" }}>
        {rows.map((r, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "18px 0",
              borderTop: i === 0 ? `2px solid ${LINE}` : "none",
              borderBottom: `2px solid ${LINE}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
              <div
                style={{
                  display: "flex",
                  width: 48,
                  fontFamily: "Playfair Display",
                  fontWeight: 600,
                  fontSize: 36,
                  color: GREEN,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </div>
              <div style={{ display: "flex", fontSize: 36, fontWeight: 600, color: INK }}>{clip(r.name, 26)}</div>
            </div>
            {r.tag ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 20px",
                  borderRadius: 999,
                  background: r.tag === "Natural" ? NAT_SOFT : PROC_SOFT,
                  color: r.tag === "Natural" ? GREEN : PROC,
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: r.tag === "Natural" ? GREEN : PROC,
                  }}
                />
                {r.tag}
              </div>
            ) : null}
          </div>
        ))}
        {more > 0 ? (
          <div style={{ display: "flex", marginTop: 18, fontSize: 28, fontWeight: 600, color: MUTED }}>+{more} more</div>
        ) : null}
      </div>

      {/* CTA */}
      <div style={{ display: "flex", padding: "0 64px 30px" }}>
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
          Know what&rsquo;s in your food
        </div>
      </div>
    </div>
  );
}
