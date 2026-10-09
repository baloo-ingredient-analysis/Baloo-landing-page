import { db } from "@/lib/db";
import { siteUrl } from "@/lib/config";
import { getListBySlug } from "@/lib/db/queries/lists";
import { getProfileById } from "@/lib/db/queries/profiles";

// Per-list llms.txt (AEO) — a plain-markdown version of one public list for AI answer engines: the
// list's intent plus its products in order, each linking to its own breakdown. The page links to it
// with a <link rel="alternate" type="text/markdown">. Sibling of the site-level /llms.txt.
//
// Privacy: a private list 404s here exactly as the page does (no existence leak). Optional-infra:
// 404 cleanly without a DB. Regenerated hourly (ISR).
export const runtime = "nodejs";
export const revalidate = 3600;

type Params = { params: Promise<{ slug: string }> };

const FOOTER =
  "Baloo is a neutral ingredient encyclopedia for packaged food — every product explained ingredient " +
  "by ingredient, in plain language. No score or verdict, ever.";

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const dbi = db();
  if (!dbi) return new Response("Not found", { status: 404 });

  const list = await getListBySlug(dbi, slug);
  if (!list || !list.isPublic) return new Response("Not found", { status: 404 });
  const owner = list.ownerId ? await getProfileById(dbi, list.ownerId) : null;

  const base = siteUrl();
  const lines: string[] = [`# ${list.title}`, ""];
  const blurb = list.description ?? list.discovery;
  if (blurb) lines.push(`> ${blurb}`, "");

  lines.push(`Source: ${base}/list/${slug}`);
  lines.push(`Curated by: ${owner ? `@${owner.handle}` : "a Baloo user"}`);
  if (list.tags?.length) lines.push(`Tags: ${list.tags.join(", ")}`);

  lines.push("", `## Products (${list.items.length})`, "");
  list.items.forEach((it, i) => {
    const brand = it.product.brand ? ` (${it.product.brand})` : "";
    lines.push(`${i + 1}. [${it.product.name}${brand}](${base}/p/${it.product.slug})`);
    if (it.note) lines.push(`   Note: ${it.note}`);
  });

  lines.push("", "---", FOOTER, "");

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
