import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { getProductForPage } from "@/lib/db/queries/products";
import { igCard, type IgRow } from "@/lib/igCard";

// Per-product Instagram card (4:5, 1080×1350) — the portrait share asset for a product, used by the
// share sheet's Instagram action. Shows the first ingredients WITH their Natural/Processed badge (the
// thing an OG link unfurl can't). nodejs runtime (postgres.js isn't edge-safe). Cached like the OG
// route; falls back to a generic Baloo card when the product/DB is absent.
export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const dbi = db();
  const data = dbi ? await getProductForPage(dbi, slug) : null;

  const count = data?.items.length ?? 0;
  const rows: IgRow[] = data
    ? data.items.slice(0, 5).map((i) => ({ name: i.name, tag: (i.tag as IgRow["tag"]) ?? null }))
    : [];

  return new ImageResponse(
    igCard({
      seed: data?.product.slug ?? "baloo",
      eyebrow: "KNOW YOUR FOOD",
      title: data?.product.name ?? "Baloo",
      chip: data?.product.brand ?? null,
      meta:
        count > 0
          ? `${count} ${count === 1 ? "ingredient" : "ingredients"}, explained`
          : "Know what's in your food",
      rows,
      moreCount: Math.max(0, count - rows.length),
      heroUrl: data?.product.heroUrl ?? null, // generated hero photo once db:heroes has run; else flat
    }),
    {
      width: 1080,
      height: 1350,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    },
  );
}
