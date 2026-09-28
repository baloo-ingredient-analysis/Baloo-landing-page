import { coverTint, monogram } from "./cover";

// The ONE Baloo Open Graph card shell (1200×630) behind every shared link — lists, products and
// profiles. Keeping the chrome here means the three cards can't drift apart (before this, each OG
// route inlined its own shell and only the list card had been polished). Layout: the leaf + wordmark
// lockup, a faint monogram watermark, a big title, an optional pill chip + meta line, optional
// numbered preview rows (a list's products / a product's ingredients / a profile's lists), and the
// "Every ingredient explained · baloo.life" footer. Satori renders this OUTSIDE Tailwind, so every
// style is inline and colours are literal hex; flat V3 tint (L1a), no gradients.

const INK = "#2D2417";
const MUTED = "#766753";
const GREEN = "#2E7D52";
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export function ogCard(opts: {
  seed: string; // drives the flat tint + watermark (list slug / product slug / handle)
  title: string;
  chip?: string | null; // pill — curator @handle, a product's brand, a profile's @handle
  meta?: string | null; // e.g. "6 products" · "12 ingredients" · "3 lists · 40 followers"
  previewItems?: string[]; // ranked rows: products / ingredients / list titles
  moreCount?: number;
}) {
  const { seed, title, chip, meta, previewItems = [], moreCount = 0 } = opts;
  const tint = coverTint(seed);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 68px",
        background: tint,
        fontFamily: "sans-serif",
      }}
    >
      {/* Faint monogram watermark — brand texture, behind the content. */}
      <div
        style={{
          position: "absolute",
          right: -30,
          top: -110,
          fontSize: 420,
          fontWeight: 700,
          color: "rgba(45,36,23,0.08)",
          lineHeight: 1,
        }}
      >
        {monogram(title)}
      </div>

      {/* Header: the exact site lockup (leaf mark + wordmark). */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <path d="M21 3C11 3 4 10 3 21c11-1 18-8 18-18Z" fill={GREEN} />
          <path d="M6.5 17.5C10 13 13.5 9.5 18 6" stroke="#EAF3EE" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <div style={{ fontSize: 34, fontWeight: 700, color: INK }}>Baloo</div>
      </div>

      {/* Title + chip/meta + preview rows. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 940 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 68, fontWeight: 700, color: INK, lineHeight: 1.03 }}>
            {clip(title, 42)}
          </div>
          {(chip || meta) && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 27, color: MUTED }}>
              {chip ? (
                <div
                  style={{
                    display: "flex",
                    padding: "4px 16px",
                    borderRadius: 999,
                    background: "rgba(45,36,23,0.06)",
                    color: INK,
                    fontWeight: 600,
                  }}
                >
                  {chip}
                </div>
              ) : null}
              {meta ? <div style={{ display: "flex" }}>{meta}</div> : null}
            </div>
          )}
        </div>

        {previewItems.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {previewItems.map((name, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    background: "rgba(45,36,23,0.07)",
                    color: MUTED,
                    fontSize: 18,
                    fontWeight: 600,
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ display: "flex", fontSize: 30, color: INK }}>{clip(name, 40)}</div>
              </div>
            ))}
            {moreCount > 0 && (
              <div style={{ display: "flex", fontSize: 24, color: MUTED, paddingLeft: 50 }}>
                + {moreCount} more
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: the promise, so a cold viewer knows what Baloo is. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 24, color: MUTED }}>
        <div style={{ display: "flex", width: 8, height: 8, borderRadius: 999, background: GREEN }} />
        <div style={{ display: "flex" }}>Every ingredient explained · baloo.life</div>
      </div>
    </div>
  );
}
