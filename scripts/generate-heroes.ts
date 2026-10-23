// Generate share-card heroes (Order: social sharing). Offline job — NOT in the request path. It finds
// products / lists that have a packshot but no hero yet, renders a warm "presented product" scene from
// the packshot(s), stores the image, and caches the URL on the row (products.hero_url / lists.hero_url).
// The app only ever READS hero_url; generation happens here with credentials, so lib/ stays portable.
//
//   npm run db:heroes -- --dry-run          # print what would be generated (prompts + refs), no spend
//   npm run db:heroes -- --products         # generate per-product heroes for the queue
//   npm run db:heroes -- --lists            # generate list heroes (composite of a list's top products)
//   npm run db:heroes -- --products --limit 10
//
// Two adapters are injected (kept out of lib/ so the pipeline stays provider-agnostic):
//   • HeroProvider — renders a hero from a prompt + reference packshots. Proven in Oct-2026 against
//     Higgsfield `marketing_studio_image` (4:5/9:16, ~2 credits & ~30s/render; cleans messy OFF
//     shop-shelf photos into a studio still life). Wire your provider in makeProvider() below.
//   • HeroStorage — persists the rendered bytes somewhere stable and returns a public URL. The default
//     uploads to Supabase Storage (needs SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL).
// Without a configured provider the job runs in dry-run only, so CI / a keyless box can still validate
// the queue and prompts. See docs/SHARE_CARDS.md.

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env.development.local" });

import { db } from "../lib/db";
import {
  buildHeroPrompt,
  heroReferenceUrls,
  type HeroInput,
  type HeroRatio,
} from "../lib/sharecard/prompt";
import {
  listsNeedingHero,
  productsNeedingHero,
  setListHero,
  setProductHero,
} from "../lib/sharecard/heroes";

// ── Adapter contracts ─────────────────────────────────────────────────────────────────────────────

export type HeroProvider = {
  /** Render one hero. `referenceUrls` are the source packshots (passed to the model to keep the real
   *  packaging); returns the rendered image bytes + content type. */
  generate(opts: {
    prompt: string;
    referenceUrls: string[];
    ratio: HeroRatio;
  }): Promise<{ bytes: Uint8Array; contentType: string }>;
};

export type HeroStorage = {
  /** Store bytes at `key` (e.g. "heroes/product/<id>.jpg") and return a stable public URL. */
  upload(key: string, bytes: Uint8Array, contentType: string): Promise<string>;
};

// ── Supabase Storage uploader (default) ─────────────────────────────────────────────────────────────

const HERO_BUCKET = process.env.HERO_BUCKET || "share-heroes";

function makeStorage(): HeroStorage | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const base = url.replace(/\/$/, "");
  return {
    async upload(objectKey, bytes, contentType) {
      // Upload (upsert) via the Storage REST API with the service role key.
      const res = await fetch(`${base}/storage/v1/object/${HERO_BUCKET}/${objectKey}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
          "Content-Type": contentType,
          "x-upsert": "true",
        },
        body: bytes as unknown as BodyInit,
      });
      if (!res.ok) throw new Error(`storage upload failed (${res.status}): ${await res.text().catch(() => "")}`);
      // Public URL (the bucket must be public, or swap for a signed URL).
      return `${base}/storage/v1/object/public/${HERO_BUCKET}/${objectKey}`;
    },
  };
}

// ── Provider wiring ─────────────────────────────────────────────────────────────────────────────────

// Wire a concrete image provider here. The validated flow (Higgsfield marketing_studio_image):
//   1. import each referenceUrl → a media id (POST /… media import)
//   2. POST a generation { model: "marketing_studio_image", prompt, aspect_ratio: ratio,
//      resolution: "2k", medias: [{role:"image", value: <media id>} …] }
//   3. poll the job(s) until completed → download result_url → return the bytes.
// Left unconfigured by default so a keyless run stays in dry-run; throwing here is intentional.
function makeProvider(): HeroProvider | null {
  if (!process.env.HIGGSFIELD_API_KEY) return null;
  return {
    async generate() {
      throw new Error(
        "HeroProvider not implemented: wire the Higgsfield (or other) image API in scripts/generate-heroes.ts makeProvider(). See docs/SHARE_CARDS.md.",
      );
    },
  };
}

// ── Job ───────────────────────────────────────────────────────────────────────────────────────────

const PRODUCT_RATIO: HeroRatio = "4:5"; // the share-card hero crop; story (9:16) can be a second pass
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

  const provider = makeProvider();
  const storage = makeStorage();
  if (!dryRun && (!provider || !storage)) {
    console.error(
      "Missing provider or storage: set HIGGSFIELD_API_KEY (+ wire makeProvider) and SUPABASE_SERVICE_ROLE_KEY. Running --dry-run instead is safe.",
    );
    process.exit(1);
  }

  async function render(kind: "product" | "list", id: string, input: HeroInput, keyBase: string) {
    const prompt = buildHeroPrompt(input);
    const refs = heroReferenceUrls(input);
    if (dryRun || !provider || !storage) {
      console.log(`\n[dry-run] ${kind} ${id}\n  refs: ${refs.length}\n  prompt: ${prompt}`);
      return;
    }
    const { bytes, contentType } = await provider.generate({ prompt, referenceUrls: refs, ratio: input.ratio });
    const ext = contentType.includes("png") ? "png" : "jpg";
    const url = await storage.upload(`${keyBase}.${ext}`, bytes, contentType);
    if (kind === "product") await setProductHero(dbi!, id, url);
    else await setListHero(dbi!, id, url);
    console.log(`✓ ${kind} ${id} → ${url}`);
  }

  if (doProducts || dryRun) {
    const queue = await productsNeedingHero(dbi, limit);
    console.log(`Products needing a hero: ${queue.length}`);
    for (const p of queue) {
      await render(
        "product",
        p.id,
        { kind: "product", ratio: PRODUCT_RATIO, products: [{ name: p.name, brand: p.brand, packshotUrl: p.packshotUrl }] },
        `heroes/product/${p.id}`,
      );
    }
  }

  if (doLists || dryRun) {
    const queue = await listsNeedingHero(dbi, limit);
    console.log(`Lists needing a hero: ${queue.length}`);
    for (const l of queue) {
      await render("list", l.listId, { kind: "list", ratio: LIST_RATIO, products: l.products }, `heroes/list/${l.listId}`);
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
