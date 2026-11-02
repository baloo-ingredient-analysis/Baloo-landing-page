import { coverTint, monogram } from "./cover";

// The Baloo Instagram share card (1080×1350, 4:5) — the portrait, post-ready sibling of ogCard. Used
// by the share sheet's Instagram action so a product or list drops straight into a feed/story at the
// right ratio. Same brand chrome as ogCard (leaf + wordmark, faint monogram watermark, title, footer),
// plus the one thing an OG unfurl never shows: the Natural / Processed badge per ingredient — the
// single meaningful colour, never a score. Satori renders this OUTSIDE Tailwind, so every style is
// inline and colours are literal hex (no gradients, V3 flat tint).

const INK = "#2D2417";
const MUTED = "#766753";
const GREEN = "#2E7D52";
const NAT_SOFT = "#E7F1EB";
const PROC = "#B5701F";
const PROC_SOFT = "#F6ECDD";
const PAPER = "#FDFAF6";
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export type IgRow = { name: string; tag?: "Natural" | "Processed" | null; sub?: string | null };

export function igCard(opts: {
  seed: string;
  eyebrow: string; // "KNOW YOUR FOOD" | "A BALOO LIST"
  title: string;
  chip?: string | null; // brand / @handle
  meta?: string | null; // "3 ingredients, explained" | "by @marco · 4 products"
  rows?: IgRow[];
  moreCount?: number;
  heroUrl?: string | null; // generated share-card hero (products.hero_url / lists.hero_url). When set,
  // the top band shows the presented product photo instead of a flat tint. Null → the flat card.
}) {
  const { seed, eyebrow, title, chip, meta, rows = [], moreCount = 0, heroUrl = null } = opts;
  const tint = coverTint(seed);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: tint,
        fontFamily: "sans-serif",
      }}
    >
      {/* Faint monogram watermark */}
      <div
        style={{
          position: "absolute",
          right: -40,
          top: -60,
          fontSize: 520,
          fontWeight: 700,
          color: "rgba(45,36,23,0.07)",
          lineHeight: 1,
        }}
      >
        {monogram(title)}
      </div>

      {/* Top band: the generated hero photo when we have one, else the tint shows through (flat card). */}
      {heroUrl ? (
        <img src={heroUrl} width={1080} height={340} style={{ width: 1080, height: 340, objectFit: "cover" }} />
      ) : (
        <div style={{ display: "flex", height: 300 }} />
      )}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          flex: 1,
          background: PAPER,
          borderTopLeftRadius: 48,
          borderTopRightRadius: 48,
          padding: "60px 72px 64px",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* Header: wordmark + eyebrow */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
                <path d="M21 3C11 3 4 10 3 21c11-1 18-8 18-18Z" fill={GREEN} />
                <path d="M6.5 17.5C10 13 13.5 9.5 18 6" stroke="#EAF3EE" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <div style={{ fontSize: 40, fontWeight: 700, color: INK }}>Baloo</div>
            </div>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: 2, color: GREEN }}>
              {eyebrow}
            </div>
          </div>

          {/* Title + chip/meta */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 40, gap: 16 }}>
            <div style={{ display: "flex", fontSize: 76, fontWeight: 700, color: INK, lineHeight: 1.02 }}>
              {clip(title, 46)}
            </div>
            {(chip || meta) && (
              <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, color: MUTED }}>
                {chip ? (
                  <div
                    style={{
                      display: "flex",
                      padding: "6px 18px",
                      borderRadius: 999,
                      background: "rgba(45,36,23,0.06)",
                      color: INK,
                      fontWeight: 600,
                    }}
                  >
                    {clip(chip, 24)}
                  </div>
                ) : null}
                {meta ? <div style={{ display: "flex" }}>{meta}</div> : null}
              </div>
            )}
          </div>

          {/* Rows: ingredients (with N/P badge) or products (with brand) */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 44, gap: 4 }}>
            {rows.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "18px 0",
                  borderBottom: i < rows.length - 1 ? "2px solid #E8DDD0" : "2px solid transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 20, minWidth: 0 }}>
                  <div style={{ display: "flex", width: 30, fontSize: 28, color: "#A39C8D", fontWeight: 600 }}>
                    {i + 1}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: INK }}>
                      {clip(r.name, 24)}
                    </div>
                    {r.sub ? (
                      <div style={{ display: "flex", fontSize: 24, color: MUTED, marginTop: 2 }}>
                        {clip(r.sub, 28).toUpperCase()}
                      </div>
                    ) : null}
                  </div>
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
                      fontSize: 26,
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
            {moreCount > 0 && (
              <div style={{ display: "flex", fontSize: 28, color: MUTED, paddingLeft: 50, paddingTop: 14 }}>
                + {moreCount} more
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 40,
            paddingTop: 28,
            borderTop: "2px solid #E8DDD0",
            fontSize: 28,
            color: MUTED,
          }}
        >
          <div style={{ display: "flex" }}>Every ingredient explained. No score, ever.</div>
          <div style={{ display: "flex", fontWeight: 700, color: GREEN }}>baloo.life</div>
        </div>
      </div>
    </div>
  );
}
