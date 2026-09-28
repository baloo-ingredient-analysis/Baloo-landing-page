import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { getProductForPage } from "@/lib/db/queries/products";
import { ogCard } from "@/lib/ogCard";

// Per-product Open Graph image (P8) — the shareable card behind a product link. Uses the shared
// ogCard shell (lib/ogCard) so it matches the list + profile cards exactly: chip = brand, and the
// preview rows are the product's first ingredients (calm, neutral — an ingredient count, never a
// score). nodejs runtime (postgres.js isn't edge-safe).
export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const dbi = db();
  const data = dbi ? await getProductForPage(dbi, slug) : null;

  const count = data?.items.length ?? 0;
  const preview = data ? data.items.slice(0, 4).map((i) => i.name) : [];

  return new ImageResponse(
    ogCard({
      seed: data?.product.slug ?? "baloo",
      title: data?.product.name ?? "Baloo",
      chip: data?.product.brand ?? null,
      meta:
        count > 0
          ? `${count} ${count === 1 ? "ingredient" : "ingredients"}, explained`
          : data?.product.retailer || "Know what's in your food",
      previewItems: preview,
      moreCount: Math.max(0, count - preview.length),
    }),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    },
  );
}
