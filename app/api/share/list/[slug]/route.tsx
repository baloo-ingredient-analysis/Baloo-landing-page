import { ImageResponse } from "next/og";
import { after } from "next/server";
import { db } from "@/lib/db";
import { getListBySlug } from "@/lib/db/queries/lists";
import { getProfileById } from "@/lib/db/queries/profiles";
import { igCard, type IgRow } from "@/lib/igCard";
import { generateAndStoreHero, heroGenerationConfigured } from "@/lib/sharecard/generate";
import { setListHero } from "@/lib/sharecard/heroes";

// Per-list Instagram card (4:5, 1080×1350) — the portrait share asset for a public list. Private
// lists and a missing DB degrade to a generic Baloo card (no existence leak). nodejs runtime.
export const runtime = "nodejs";
// Give the background hero render (OpenAI, in after()) room to finish — it outlives the response.
export const maxDuration = 60;

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

  // Lazy-on-first-share: no hero yet → generate one in the background from the list's top imaged
  // products, cache it, and it appears on the next fetch. Best-effort; never blocks or breaks the card,
  // and a no-op when generation isn't configured. Runs once per list (hero_url is then set).
  if (!list.heroUrl && heroGenerationConfigured()) {
    const heroProducts = list.items
      .map((it) => it.product)
      .filter((p) => p.imageUrl)
      .slice(0, 4)
      .map((p) => ({ name: p.name, brand: p.brand, packshotUrl: p.imageUrl as string }));
    if (heroProducts.length > 0) {
      after(async () => {
        try {
          const heroUrl = await generateAndStoreHero(
            { kind: "list", ratio: "4:5", products: heroProducts },
            `list/${list.id}`,
          );
          if (heroUrl) await setListHero(dbi!, list.id, heroUrl);
        } catch (err) {
          console.error("lazy list hero error (ignored):", err);
        }
      });
    }
  }

  return new ImageResponse(
    igCard({
      seed: list.slug,
      eyebrow: "A BALOO LIST",
      title: list.title,
      chip: owner ? `@${owner.handle}` : null,
      meta: `${count} ${count === 1 ? "product" : "products"}`,
      rows,
      moreCount: Math.max(0, count - rows.length),
      heroUrl: list.heroUrl ?? null, // the generated hero photo, once db:heroes has run; else flat card
    }),
    {
      width: 1080,
      height: 1350,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    },
  );
}
