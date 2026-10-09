import { db } from "@/lib/db";
import { siteUrl } from "@/lib/config";
import { getRecentProducts } from "@/lib/db/queries/products";
import { getPublicListsRecent } from "@/lib/db/queries/lists";

// Site-level llms.txt (AEO) — a plain-markdown map of Baloo for AI answer engines (the emerging
// llms.txt convention): what Baloo is, the key pages, and a sample of real products + lists to crawl.
// Optional-infra: with no DB it's still the static description. Regenerated hourly (ISR).
export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET() {
  const base = siteUrl();
  const dbi = db();
  const [products, lists] = dbi
    ? await Promise.all([getRecentProducts(dbi, 15), getPublicListsRecent(dbi, 15)])
    : [[], []];

  const lines: string[] = [
    "# Baloo",
    "",
    "> Baloo explains what's in packaged food — every ingredient in plain language, plus the nutrition " +
      "panel in context. Paste a supermarket product link or search a product to get a per-ingredient " +
      "breakdown: what each ingredient is, and why it's in that product. On top sits a community of " +
      "curated lists. No health score, no good/bad verdict, ever — education, not advice.",
    "",
    "## Key pages",
    `- [Baloo home — analyse any product](${base}/): paste a product link, or search a product.`,
    `- [Discover](${base}/discover): community lists, every product explained ingredient by ingredient.`,
    "",
    "Every product and list page also has a plain-markdown version for machines at the same path + " +
      "`/llms.txt` (e.g. `/p/<slug>/llms.txt`, `/list/<slug>/llms.txt`).",
    "",
    "## What Baloo is",
    "- A neutral ingredient encyclopedia for packaged food: what each ingredient is and why it's used.",
    "- Nutrition shown in context against public UK reference intakes — numbers, never a verdict.",
    "- No score, rating, traffic-light, or good/bad judgement anywhere. Context over judgement.",
  ];

  if (products.length) {
    lines.push("", "## Recently analysed products");
    for (const p of products) lines.push(`- [${p.name}${p.brand ? ` (${p.brand})` : ""}](${base}/p/${p.slug})`);
  }
  if (lists.length) {
    lines.push("", "## Community lists");
    for (const l of lists) lines.push(`- [${l.title}](${base}/list/${l.slug})`);
  }
  lines.push("");

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
