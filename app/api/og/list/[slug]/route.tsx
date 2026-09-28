import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { getListBySlug } from "@/lib/db/queries/lists";
import { getProfileById } from "@/lib/db/queries/profiles";
import { ogCard } from "@/lib/ogCard";

// Per-list Open Graph image (Order G4) — uses the shared ogCard shell (lib/ogCard), the polished card
// this design originated from: chip = curator @handle, preview rows = the list's first products.
// nodejs runtime (postgres.js isn't edge-safe).
export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const dbi = db();
  const list = dbi ? await getListBySlug(dbi, slug) : null;
  // ownerId is nullable since S7a (deleted curator) — the card just drops the "by @handle".
  const owner = list?.ownerId && dbi ? await getProfileById(dbi, list.ownerId) : null;

  const items = list?.items ?? [];
  const count = items.length;
  const preview = items.slice(0, 4).map((it) => it.product.name);

  return new ImageResponse(
    ogCard({
      seed: list?.slug ?? "baloo",
      title: list?.title ?? "Baloo",
      chip: owner ? `@${owner.handle}` : null,
      meta: `${count} ${count === 1 ? "product" : "products"}`,
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
