import { db } from "@/lib/db";
import { siteUrl } from "@/lib/config";
import { getProductForPage } from "@/lib/db/queries/products";
import { storedIngredients } from "@/lib/analysis/stored";

// Per-product llms.txt (AEO) — a plain-markdown version of one product's ingredient breakdown for AI
// answer engines: no nav chrome, no JS, just the facts in label order. The page links to it with a
// <link rel="alternate" type="text/markdown">. Sibling of the site-level /llms.txt.
//
// Content is English (the analysis layer is English until the engine serves Spanish), so this route
// is locale-agnostic — no /es variant. Optional-infra: 404 cleanly when the DB is absent.
// Regenerated hourly (ISR).
export const runtime = "nodejs";
export const revalidate = 3600;

type Params = { params: Promise<{ slug: string }> };

const FOOTER =
  "Baloo explains what's in packaged food, ingredient by ingredient, in plain language. " +
  "No health score, rating, or good/bad verdict, ever — education, not advice.";

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const dbi = db();
  const data = dbi ? await getProductForPage(dbi, slug) : null;
  if (!data) return new Response("Not found", { status: 404 });

  const base = siteUrl();
  const p = data.product;
  const lines: string[] = [`# ${p.name}${p.brand ? ` (${p.brand})` : ""}`, ""];
  if (data.summary) lines.push(`> ${data.summary}`, "");

  lines.push(`Source: ${base}/p/${slug}`);
  if (p.retailer) lines.push(`Seen at: ${p.retailer}`);
  if (p.category) lines.push(`Category: ${p.category}`);

  const ingredients = storedIngredients(data);
  if (ingredients.length) {
    lines.push("", `## Ingredients (${ingredients.length}, in label order)`, "");
    ingredients.forEach((ing, i) => {
      const bits = [ing.tag, ing.role].filter(Boolean).join(" · ");
      const pct = ing.percentage ? ` — ${ing.percentage}` : "";
      lines.push(`${i + 1}. ${ing.name}${pct}${bits ? ` (${bits})` : ""}`);
      if (ing.what_it_is) lines.push(`   What it is: ${ing.what_it_is}`);
      if (ing.why_its_here) lines.push(`   Why it's here: ${ing.why_its_here}`);
    });
  } else {
    lines.push("", "Ingredient analysis pending for this product.");
  }

  const nutrients = data.nutrition?.nutrients ?? [];
  if (nutrients.length) {
    const basis = data.nutrition!.per === "serving" ? "per serving" : "per 100g/ml";
    const serving = data.nutrition!.servingSize ? ` · serving: ${data.nutrition!.servingSize}` : "";
    lines.push("", `## Nutrition (${basis}${serving})`, "");
    for (const n of nutrients) {
      const val = n.per_100g ?? n.per_serving;
      if (val == null) continue;
      lines.push(`- ${n.name}: ${val}${n.unit ?? ""}`);
    }
    lines.push(
      "",
      "Figures are the label panel as printed; shown as neutral context against public UK reference " +
        "intakes, never a score or verdict.",
    );
  }

  lines.push("", "---", FOOTER, "");

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
