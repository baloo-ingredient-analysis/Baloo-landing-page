import { ImageResponse } from "next/og";
import { after } from "next/server";
import { db } from "@/lib/db";
import { getListBySlug } from "@/lib/db/queries/lists";
import { getProfileById } from "@/lib/db/queries/profiles";
import { igCard } from "@/lib/igCard";
import { editorialCard } from "@/lib/sharecard/editorialCard";
import { loadCardFonts } from "@/lib/sharecard/cardFonts";
import { generateAndStoreHero, heroGenerationConfigured } from "@/lib/sharecard/generate";
import { pickHeroProducts } from "@/lib/sharecard/prompt";
import { claimListHero, setListHero } from "@/lib/sharecard/heroes";

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

  // Lazy-on-first-share: no hero yet → generate one in the background from the list's top imaged
  // products, cache it, and it appears on the next fetch. Best-effort; never blocks or breaks the card,
  // and a no-op when generation isn't configured. Runs once per list (hero_url is then set).
  if (!list.heroUrl && heroGenerationConfigured()) {
    const heroProducts = pickHeroProducts(
      list.items.map((it) => it.product).filter((p) => p.imageUrl),
      4,
    ).map((p) => ({ name: p.name, brand: p.brand, packshotUrl: p.imageUrl as string }));
    if (heroProducts.length > 0) {
      after(async () => {
        try {
          if (!(await claimListHero(dbi!, list.id))) return; // another request is already generating
          const heroUrl = await generateAndStoreHero(
            { kind: "list", ratio: "4:5", products: heroProducts },
            `list/${list.id}`,
          );
          if (heroUrl) await setListHero(dbi!, list.id, heroUrl);
          // on failure hero_generated_at stays set → a short cooldown before the next attempt
        } catch (err) {
          console.error("lazy list hero error (ignored):", err);
        }
      });
    }
  }

  const subtitle = Array.isArray(list.tags) && list.tags.length ? list.tags.slice(0, 3).join(" · ") : null;
  const headers = { "Cache-Control": "public, max-age=3600, s-maxage=86400" };

  try {
    const fonts = await loadCardFonts();
    return new ImageResponse(
      editorialCard({
        title: list.title,
        subtitle,
        heroUrl: list.heroUrl ?? null,
        ownerName: owner?.displayName ?? null,
        handle: owner?.handle ?? null,
        productCount: count,
      }),
      { width: 1080, height: 1350, fonts, headers },
    );
  } catch (err) {
    // A font-load / Satori failure must never break the share card — degrade to the flat card.
    console.error("editorial card render failed, using flat card:", err);
    return new ImageResponse(
      igCard({
        seed: list.slug,
        eyebrow: "A BALOO LIST",
        title: list.title,
        chip: owner ? `@${owner.handle}` : null,
        meta: `${count} ${count === 1 ? "product" : "products"}`,
        heroUrl: list.heroUrl ?? null,
      }),
      { width: 1080, height: 1350, headers },
    );
  }
}
