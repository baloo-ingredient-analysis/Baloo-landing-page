import { ImageResponse } from "next/og";
import { after } from "next/server";
import { db } from "@/lib/db";
import { getListBySlug } from "@/lib/db/queries/lists";
import { getProfileById } from "@/lib/db/queries/profiles";
import { igCard } from "@/lib/igCard";
import { editorialCard } from "@/lib/sharecard/editorialCard";
import { designedCard } from "@/lib/sharecard/designedCard";
import { loadCardFonts } from "@/lib/sharecard/cardFonts";
import { generateAndStoreHero, heroGenerationConfigured } from "@/lib/sharecard/generate";
import { classifyAndPlanHero } from "@/lib/sharecard/packshotQuality";
import { claimListHero, setListHero } from "@/lib/sharecard/heroes";

// Per-list Instagram card — the portrait share asset for a public list. `?format=story` gives the 9:16
// story (1080×1920); the default is the 4:5 feed (1080×1350). Same editorial/designed cards, same image
// ladder; only the canvas height (and the designed card's row count) changes. Private lists and a missing
// DB degrade to a generic Baloo card (no existence leak). nodejs runtime.
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

export async function GET(req: Request, { params }: Params) {
  const { slug } = await params;
  const story = new URL(req.url).searchParams.get("format") === "story";
  const size = { width: 1080, height: story ? 1920 : 1350 };
  const dbi = db();
  const list = dbi ? await getListBySlug(dbi, slug) : null;

  if (!list || !list.isPublic) {
    return new ImageResponse(GENERIC, size);
  }

  // list is non-null here, so dbi was non-null too (the query above used it).
  const owner = list.ownerId ? await getProfileById(dbi!, list.ownerId) : null;
  const count = list.items.length;

  // Image priority (the agreed ladder): the author's OWN chosen cover wins — it's consented and always
  // accurate, zero rights/accuracy risk (Igor's "a cover the list author chooses"). Only when there is
  // no cover do we fall to a generated product hero.
  const listImage = list.coverUrl ?? list.heroUrl ?? null;

  // Lazy-on-first-share: no cover AND no hero yet → generate one in the background from the list's top
  // imaged products, cache it, and it appears on the next fetch. Best-effort; never blocks or breaks the
  // card, and a no-op when generation isn't configured. Runs once per list (hero_url is then set). A list
  // with an author cover never triggers generation (and never spends a credit).
  if (!list.coverUrl && !list.heroUrl && heroGenerationConfigured()) {
    const imaged = list.items
      .map((it) => it.product)
      .filter((p) => p.imageUrl)
      .map((p) => ({ name: p.name, brand: p.brand, packshotUrl: p.imageUrl as string }));
    if (imaged.length > 0) {
      after(async () => {
        try {
          if (!(await claimListHero(dbi!, list.id))) return; // another request is already generating
          // Gate on packshot quality: only feed CLEAN 3D packshots to the generator (the quality
          // detector). A flat-scan-only or lifestyle-only list keeps its flat/brand card instead of a
          // poor hero, and never burns a generation credit.
          const plan = await classifyAndPlanHero(imaged, 4);
          if (plan.strategy !== "hybrid") return;
          const heroUrl = await generateAndStoreHero(
            { kind: "list", ratio: "4:5", products: plan.products },
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
    // With an image (author cover or a clean generated hero) → the editorial photo card. Without one
    // (no cover, and either no clean packshot or a hero still generating) → the designed no-photo card:
    // always accurate, never an empty panel, and the permanent card for lists the detector sends to fallback.
    const card = listImage
      ? editorialCard({
          title: list.title,
          subtitle,
          heroUrl: listImage,
          ownerName: owner?.displayName ?? null,
          handle: owner?.handle ?? null,
          productCount: count,
        })
      : designedCard({
          title: list.title,
          subtitle,
          items: list.items.map((it) => it.product.name),
          ownerName: owner?.displayName ?? null,
          handle: owner?.handle ?? null,
          productCount: count,
          maxRows: story ? 9 : 6, // the taller story fits more of the list
        });
    return new ImageResponse(card, { ...size, fonts, headers });
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
        heroUrl: listImage,
      }),
      { ...size, headers },
    );
  }
}
