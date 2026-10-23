// Generate share-card heroes (offline job — NOT in the request path). Finds products / lists that have
// a packshot but no hero yet, renders a warm "presented product" scene from the packshot(s) and caches
// the URL on the row (products.hero_url / lists.hero_url). The app only ever READS hero_url; this runs
// where the keys live (your machine or a deploy).
//
//   npm run db:heroes -- --dry-run          # print the queue + prompts, no spend
//   npm run db:heroes -- --products         # generate per-product heroes
//   npm run db:heroes -- --lists            # generate list heroes (composite of a list's top products)
//   npm run db:heroes -- --products --limit 10
//
// Needs, in .env.local (or the shell): DATABASE_URL, OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY,
// NEXT_PUBLIC_SUPABASE_URL, plus a public Storage bucket `share-heroes`. Without them --dry-run still
// works so you can validate the queue. See docs/SHARE_CARDS.md.

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env.development.local" });

import { db } from "../lib/db";
import { buildHeroPrompt, heroReferenceUrls, type HeroInput, type HeroRatio } from "../lib/sharecard/prompt";
import { generateAndStoreHero, heroGenerationConfigured } from "../lib/sharecard/generate";
import {
  listsNeedingHero,
  productsNeedingHero,
  setListHero,
  setProductHero,
} from "../lib/sharecard/heroes";

const PRODUCT_RATIO: HeroRatio = "4:5";
const LIST_RATIO: HeroRatio = "4:5";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const dbi = db();
  if (!dbi) {
    console.error("DATABASE_URL is not set — nothing to generate.");
    process.exit(1);
  }
  const dryRun = process.argv.includes("--dry-run");
  const doProducts = process.argv.includes("--products");
  const doLists = process.argv.includes("--lists");
  const limit = Number(arg("--limit") ?? 50);
  if (!doProducts && !doLists && !dryRun) {
    console.error("Pass --products and/or --lists (or --dry-run to preview). See docs/SHARE_CARDS.md.");
    process.exit(1);
  }
  if (!dryRun && !heroGenerationConfigured()) {
    console.error(
      "Not configured: set OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL (and a public `share-heroes` bucket). Use --dry-run to preview without them.",
    );
    process.exit(1);
  }

  async function run(kind: "product" | "list", id: string, input: HeroInput, objectKey: string) {
    if (dryRun) {
      console.log(`\n[dry-run] ${kind} ${id}\n  refs: ${heroReferenceUrls(input).length}\n  prompt: ${buildHeroPrompt(input)}`);
      return;
    }
    const url = await generateAndStoreHero(input, objectKey);
    if (!url) {
      console.warn(`× ${kind} ${id}: generation returned nothing (see logs) — skipped.`);
      return;
    }
    if (kind === "product") await setProductHero(dbi!, id, url);
    else await setListHero(dbi!, id, url);
    console.log(`✓ ${kind} ${id} → ${url}`);
  }

  if (doProducts || dryRun) {
    const queue = await productsNeedingHero(dbi, limit);
    console.log(`Products needing a hero: ${queue.length}`);
    for (const p of queue) {
      await run(
        "product",
        p.id,
        { kind: "product", ratio: PRODUCT_RATIO, products: [{ name: p.name, brand: p.brand, packshotUrl: p.packshotUrl }] },
        `product/${p.id}`,
      );
    }
  }

  if (doLists || dryRun) {
    const queue = await listsNeedingHero(dbi, limit);
    console.log(`Lists needing a hero: ${queue.length}`);
    for (const l of queue) {
      await run("list", l.listId, { kind: "list", ratio: LIST_RATIO, products: l.products }, `list/${l.listId}`);
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
