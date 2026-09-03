import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getProductForPage } from "@/lib/db/queries/products";
import { getOffersForProduct } from "@/lib/db/queries/offers";
import { storedAsCachedResult } from "@/lib/analysis/stored";

export const runtime = "nodejs";

// Quick-view (P5): a product's stored analysis as JSON, for the in-context drawer. Public read — the
// SAME catalog data the SSR product page renders, no Claude call. 404 when the product is unknown or
// not analysed yet. (Sibling static routes /analyze and /search take precedence over this [slug].)
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dbi = db();
  if (!dbi) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const data = await getProductForPage(dbi, slug);
  if (!data || data.items.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const offers = await getOffersForProduct(dbi, data.product.id);
  return NextResponse.json({
    slug,
    result: storedAsCachedResult(data, ""), // { product_name, retailer, ingredients, nutrition, product_summary }
    offers: offers.map((o) => ({ retailer: o.retailer, url: o.url })),
  });
}
