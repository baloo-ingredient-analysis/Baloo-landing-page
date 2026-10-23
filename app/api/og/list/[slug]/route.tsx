import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { getListBySlug } from "@/lib/db/queries/lists";
import { getProfileById } from "@/lib/db/queries/profiles";
import { ogCard } from "@/lib/ogCard";
import { wideCard } from "@/lib/sharecard/wideCard";
import { loadCardFonts } from "@/lib/sharecard/cardFonts";

// Per-list Open Graph image (Order G4) — the 1.91:1 link unfurl behind every shared Baloo list link, the
// broadest growth surface. Upgraded to the editorial "Quiet Field Guide" wide card (lib/sharecard/wideCard,
// matching Jetain's landscape mockup): same image ladder as the portrait share card — the author's cover
// or a clean generated hero fills the right panel, else the no-photo numbered list keeps it accurate.
// Private/missing lists and any render failure degrade to the generic flat ogCard (no existence leak).
// nodejs runtime (postgres.js isn't edge-safe).
export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string }> };

const SIZE = { width: 1200, height: 630 } as const;
const headers = { "Cache-Control": "public, max-age=3600, s-maxage=86400" };

const GENERIC = ogCard({ seed: "baloo", title: "Baloo", meta: "Know what's in your food" });

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const dbi = db();
  const list = dbi ? await getListBySlug(dbi, slug) : null;

  if (!list || !list.isPublic) {
    return new ImageResponse(GENERIC, { ...SIZE, headers });
  }

  // ownerId is nullable since S7a (deleted curator) — the card just drops the "by @handle".
  const owner = list.ownerId ? await getProfileById(dbi!, list.ownerId) : null;
  const count = list.items.length;
  const subtitle = Array.isArray(list.tags) && list.tags.length ? list.tags.slice(0, 3).join(" · ") : null;
  const image = list.coverUrl ?? list.heroUrl ?? null; // author cover wins, then a generated hero

  try {
    const fonts = await loadCardFonts();
    return new ImageResponse(
      wideCard({
        title: list.title,
        subtitle,
        heroUrl: image,
        items: list.items.map((it) => it.product.name),
        ownerName: owner?.displayName ?? null,
        handle: owner?.handle ?? null,
        productCount: count,
      }),
      { ...SIZE, fonts, headers },
    );
  } catch (err) {
    // A font-load / Satori failure must never break the unfurl — degrade to the flat ogCard.
    console.error("wide og card render failed, using flat card:", err);
    return new ImageResponse(
      ogCard({
        seed: list.slug,
        title: list.title,
        chip: owner ? `@${owner.handle}` : null,
        meta: `${count} ${count === 1 ? "product" : "products"}`,
        previewItems: list.items.slice(0, 4).map((it) => it.product.name),
        moreCount: Math.max(0, count - 4),
      }),
      { ...SIZE, headers },
    );
  }
}
