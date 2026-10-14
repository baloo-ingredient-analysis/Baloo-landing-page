import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { getListBySlug } from "@/lib/db/queries/lists";
import { getProfileById } from "@/lib/db/queries/profiles";
import { igCard, type IgRow } from "@/lib/igCard";

// Per-list Instagram card (4:5, 1080×1350) — the portrait share asset for a public list. Private
// lists and a missing DB degrade to a generic Baloo card (no existence leak). nodejs runtime.
export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string }> };

const GENERIC = igCard({
  seed: "baloo",
  eyebrow: "A BALOO LIST",
  title: "Baloo",
  meta: "Know what's in your food",
});

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const dbi = db();
  const list = dbi ? await getListBySlug(dbi, slug) : null;

  if (!list || !list.isPublic) {
    return new ImageResponse(GENERIC, { width: 1080, height: 1350 });
  }

  // list is non-null here, so dbi was non-null too (the query above used it).
  const owner = list.ownerId ? await getProfileById(dbi!, list.ownerId) : null;
  const count = list.items.length;
  const rows: IgRow[] = list.items
    .slice(0, 5)
    .map((it) => ({ name: it.product.name, sub: it.product.brand ?? null }));

  return new ImageResponse(
    igCard({
      seed: list.slug,
      eyebrow: "A BALOO LIST",
      title: list.title,
      chip: owner ? `@${owner.handle}` : null,
      meta: `${count} ${count === 1 ? "product" : "products"}`,
      rows,
      moreCount: Math.max(0, count - rows.length),
    }),
    {
      width: 1080,
      height: 1350,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    },
  );
}
