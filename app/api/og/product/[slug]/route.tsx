import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { getProductForPage } from "@/lib/db/queries/products";
import { coverTint, monogram } from "@/lib/cover";

// Per-product Open Graph image (P8) — the shareable card behind a product link. Mirrors the list OG
// route (same flat V3 tint + wordmark + monogram watermark, on-brand) so a shared product previews
// on brand across WhatsApp/IG/etc. nodejs runtime (postgres.js isn't edge-safe).
export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const dbi = db();
  const data = dbi ? await getProductForPage(dbi, slug) : null;

  const title = data?.product.name ?? "Baloo";
  const tint = coverTint(data?.product.slug ?? "baloo");
  const count = data?.items.length ?? 0;
  // Calm, neutral sub — an ingredient count (never a score) plus the brand/retailer if we have it.
  const maker = data?.product.brand || data?.product.retailer || "";
  const sub = data
    ? count > 0
      ? `${count} ${count === 1 ? "ingredient" : "ingredients"}, explained${maker ? ` · ${maker}` : ""}`
      : maker || "Know what's in your food"
    : "Know what's in your food";

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
          padding: "72px",
          background: tint, // flat V3 tint (L1a); ink/muted hex inlined (renders outside Tailwind)
        }}
      >
        <div style={{ fontSize: 36, fontWeight: 700, color: "#2D2417" }}>Baloo</div>
        <div
          style={{
            position: "absolute",
            right: 40,
            bottom: -40,
            fontSize: 460,
            fontWeight: 700,
            color: "rgba(45,36,23,0.13)",
            lineHeight: 1,
          }}
        >
          {monogram(title)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 860 }}>
          <div style={{ fontSize: 66, fontWeight: 700, color: "#2D2417", lineHeight: 1.1 }}>{title}</div>
          <div style={{ fontSize: 30, color: "#766753" }}>{sub}</div>
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
