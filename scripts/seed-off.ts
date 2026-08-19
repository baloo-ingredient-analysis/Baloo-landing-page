// Seed the catalog from Open Food Facts (Order OFF3) so search feels full on day one instead of
// nearly empty. Each entry is a product NAME; we resolve it to the best OFF match and import it
// (analyse once, cache forever). UK/ES-leaning popular products, including own-brands.
//
//   npm run db:seed-off            # DRY RUN — resolves each name to its OFF match, imports nothing
//   npm run db:seed-off -- --run   # actually import (one Claude analyse per NEW product)
//
// Dry-run first so you can see what each name resolves to before spending. Already-known products are
// reused with no Claude call. Gentle pacing between imports (OFF + our own rate limits).
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env.development.local" });

import { db } from "../lib/db";
import { searchOffCandidates } from "../lib/openfoodfacts";
import { importOffByBarcode } from "../lib/offImport";

// Curated seed set — recognisable products likely present on OFF with an ingredient list. Names, not
// barcodes, so it's easy to extend. Mix of national brands + supermarket own-brands (UK/ES).
const SEED: string[] = [
  "Nutella",
  "Nocilla original",
  "Heinz Baked Beans",
  "Oatly Barista",
  "Coca-Cola original",
  "Pringles Original",
  "Philadelphia original",
  "Hellmann's Real Mayonnaise",
  "Kellogg's Corn Flakes",
  "Ben & Jerry's Cookie Dough",
  "Alpro Soya drink",
  "Actimel original",
  "Hacendado crema de cacao",
  "Milbona yogur natural",
  "President mantequilla",
  "Gallo espaguetis",
  "Central Lechera Asturiana leche entera",
  "Bimbo pan de molde",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const run = process.argv.includes("--run");
  const dbi = db();
  if (!dbi) {
    console.error("DATABASE_URL not set — cannot seed.");
    process.exit(1);
  }
  console.log(`${run ? "IMPORTING" : "DRY RUN"} — ${SEED.length} products\n`);

  const tally = { imported: 0, reused: 0, notFound: 0, failed: 0 };
  for (const name of SEED) {
    const [top] = await searchOffCandidates(name, 3);
    if (!top) {
      console.log(`  [not found]  "${name}"`);
      tally.notFound++;
      continue;
    }
    if (!run) {
      console.log(`  "${name}"  ->  ${top.name}${top.brand ? ` (${top.brand})` : ""}  [${top.barcode}]`);
      continue;
    }
    const res = await importOffByBarcode(top.barcode);
    if (res.ok) {
      console.log(`  [${res.reused ? "reused" : "imported"}]  ${top.name}  /${res.slug}`);
      res.reused ? tally.reused++ : tally.imported++;
    } else {
      console.log(`  [failed: ${res.reason}]  "${name}" (${top.barcode})`);
      tally.failed++;
    }
    await sleep(1200); // pace the Claude + OFF calls
  }

  if (run) {
    console.log(`\nDone. imported ${tally.imported}, reused ${tally.reused}, not found ${tally.notFound}, failed ${tally.failed}`);
  } else {
    console.log(`\nDry run complete. Re-run with -- --run to import.`);
  }
  process.exit(0);
}
main();
