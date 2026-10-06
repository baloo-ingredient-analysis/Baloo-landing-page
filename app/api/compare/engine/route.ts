import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getProductForPage } from "@/lib/db/queries/products";
import { analyseViaEngine } from "@/lib/recognition";

// Internal engine-compare (feat/engine-compare): for one catalog product, return OUR stored analysis
// and the recognition engine's output (adapted to our shapes) side by side, so we can judge the swap
// before wiring it in. Internal tool like /api/compare/commercial — not linked, the page is noindex.
// Hits Igor's paid endpoints, so it's a deliberate per-request action, not something users reach.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const locale = url.searchParams.get("locale") === "es" ? "es" : "en"; // en | es for the Spain-first look
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const dbi = db();
  if (!dbi) return NextResponse.json({ error: "no_db" }, { status: 503 });

  const data = await getProductForPage(dbi, slug);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const ours = {
    summary: data.summary,
    nutrition: data.nutrition ? { per: data.nutrition.per, nutrients: data.nutrition.nutrients } : null,
    ingredients: data.items.map((i) => ({
      name: i.name,
      tag: i.tag,
      role: i.role,
      percent: i.percent,
      whatItIs: i.whatItIs,
      whyItsHere: i.whyItsHere,
      percentageNote: i.percentageNote,
    })),
  };

  // Engine side — resolve by barcode (preferred) with brand+name as a hint.
  const barcode = data.product.barcode ?? undefined;
  let engine: Record<string, unknown>;
  if (!barcode) {
    engine = { ok: false, reason: "no_barcode" };
  } else {
    const res = await analyseViaEngine({
      barcode,
      brand: data.product.brand ?? undefined,
      productName: data.product.name,
      locale,
    });
    if (res.ok) {
      engine = {
        ok: true,
        summary: res.analysis.product_summary,
        nutrition: res.analysis.nutrition
          ? { per: res.analysis.nutrition.per, nutrients: res.analysis.nutrition.nutrients }
          : null,
        ingredients: res.analysis.ingredients, // adapted to OUR shape
        // The engine's raw per-ingredient signals, so the 3-value tag + source-language names are visible.
        raw: (res.raw.ingredients ?? []).map((r) => ({
          canonical_name: r.canonical_name,
          localized_name: r.localized_name ?? null,
          processing_tag: r.processing_tag ?? null,
          percent: r.percent ?? null,
          percent_type: r.percent_type ?? null,
          role_tags: r.role_tags ?? [],
        })),
      };
    } else {
      engine = { ok: false, reason: res.reason };
    }
  }

  return NextResponse.json({
    product: { name: data.product.name, slug: data.product.slug, barcode: data.product.barcode },
    ours,
    engine,
  });
}
