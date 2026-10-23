import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { getProductForPage } from "@/lib/db/queries/products";
import { igCard, type IgRow } from "@/lib/igCard";
import { productCard, type ProductCardRow } from "@/lib/sharecard/productCard";
import { loadCardFonts } from "@/lib/sharecard/cardFonts";

// Per-product Instagram card (4:5, 1080×1350) — the portrait share asset for a product, used by the
// share sheet's Instagram action. Foregrounds the ingredients WITH their Natural/Processed pill (the
// thing an OG link unfurl can't show) in the editorial "Quiet Field Guide" style — photo-free by design,
// so it is ALWAYS accurate and carries no image-rights risk (Igor's concern), and renders for every
// product. A font/Satori failure degrades to the flat igCard; a missing product/DB → a generic card.
// nodejs runtime (postgres.js isn't edge-safe).
export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string }> };

const SIZE = { width: 1080, height: 1350 };
const headers = { "Cache-Control": "public, max-age=3600, s-maxage=86400" };

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const dbi = db();
  const data = dbi ? await getProductForPage(dbi, slug) : null;

  const count = data?.items.length ?? 0;
  const rows: ProductCardRow[] = data
    ? data.items.slice(0, 6).map((i) => ({ name: i.name, tag: (i.tag as ProductCardRow["tag"]) ?? null }))
    : [];

  if (!data) {
    return new ImageResponse(
      igCard({ seed: "baloo", eyebrow: "KNOW YOUR FOOD", title: "Baloo", meta: "Know what's in your food" }),
      { ...SIZE, headers },
    );
  }

  try {
    const fonts = await loadCardFonts();
    return new ImageResponse(
      productCard({
        name: data.product.name,
        brand: data.product.brand,
        items: rows,
        ingredientCount: count,
      }),
      { ...SIZE, fonts, headers },
    );
  } catch (err) {
    // A font-load / Satori failure must never break the share card — degrade to the flat igCard.
    console.error("product card render failed, using flat card:", err);
    return new ImageResponse(
      igCard({
        seed: data.product.slug,
        eyebrow: "KNOW YOUR FOOD",
        title: data.product.name,
        chip: data.product.brand ?? null,
        meta: count > 0 ? `${count} ${count === 1 ? "ingredient" : "ingredients"}, explained` : "Know what's in your food",
        rows: rows as IgRow[],
        moreCount: Math.max(0, count - rows.length),
      }),
      { ...SIZE, headers },
    );
  }
}
