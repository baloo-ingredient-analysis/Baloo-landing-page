import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { getListBySlug } from "@/lib/db/queries/lists";
import { getProfileById } from "@/lib/db/queries/profiles";
import { coverTint, monogram } from "@/lib/cover";

// Per-list Open Graph image (Order G4; polished for the share loop) — mirrors the on-page ListCover
// via the same lib/cover tint, and previews the actual products so a shared link teases what's inside,
// not just a count. Flat V3 tint, no gradients (L1a). nodejs runtime (postgres.js isn't edge-safe).
export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string }> };

const INK = "#2D2417";
const MUTED = "#766753";
const GREEN = "#2E7D52";
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const dbi = db();
  const list = dbi ? await getListBySlug(dbi, slug) : null;
  // ownerId is nullable since S7a (deleted curator) — the card just drops the "by @handle".
  const owner = list?.ownerId && dbi ? await getProfileById(dbi, list.ownerId) : null;

  const title = list?.title ?? "Baloo";
  const tint = coverTint(list?.slug ?? "baloo");
  const items = list?.items ?? [];
  const count = items.length;
  const preview = items.slice(0, 4);
  const more = count - preview.length;

  return new ImageResponse(
    (
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

        {/* Title + curator + product preview. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 940 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 68, fontWeight: 700, color: INK, lineHeight: 1.03 }}>
              {clip(title, 42)}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 27, color: MUTED }}>
              {owner ? (
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
                  @{owner.handle}
                </div>
              ) : null}
              <div style={{ display: "flex" }}>
                {count} {count === 1 ? "product" : "products"}
              </div>
            </div>
          </div>

          {/* Product rows — ranked, matching the on-page list. This is what makes a shared link land. */}
          {preview.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {preview.map((it, i) => (
                <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 16 }}>
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
                  <div style={{ display: "flex", fontSize: 30, color: INK }}>
                    {clip(it.product.name, 40)}
                  </div>
                </div>
              ))}
              {more > 0 && (
                <div style={{ display: "flex", fontSize: 24, color: MUTED, paddingLeft: 50 }}>
                  + {more} more
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
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    },
  );
}
