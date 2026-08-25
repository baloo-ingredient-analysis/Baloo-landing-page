// Backfill product sales markets (`products.countries`) from Open Food Facts. One-off after applying
// the migration that adds the column. Looks each barcoded product up on OFF and stores its
// countries_tags (humanised) so search can enforce the ES/UK market gate on the existing catalog.
//   npm run db:countries          # only products missing countries (null)
//   npm run db:countries -- --all # re-fetch markets for every barcoded product
//
// Products without a barcode can't be resolved on OFF and are left null (unknown → never hidden).
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env.development.local" });

import { and, eq, isNull, isNotNull, ne } from "drizzle-orm";
import { db } from "../lib/db";
import { products } from "../lib/db/schema";
import { getOffProductByBarcode } from "../lib/openfoodfacts";

async function main() {
  const dbi = db();
  if (!dbi) {
    console.error("DATABASE_URL is not set — nothing to backfill.");
    process.exit(1);
  }

  const all = process.argv.includes("--all");
  const cols = { id: products.id, name: products.name, barcode: products.barcode };
  const hasBarcode = and(isNotNull(products.barcode), ne(products.barcode, ""));
  const rows = await (all
    ? dbi.select(cols).from(products).where(hasBarcode)
    : dbi.select(cols).from(products).where(and(hasBarcode, isNull(products.countries))));

  if (rows.length === 0) {
    console.log("Nothing to backfill (every barcoded product already has markets). Use --all to refresh.");
    return;
  }
  console.log(`Fetching markets for ${rows.length} product(s) from OFF…`);

  let done = 0;
  for (const r of rows) {
    const off = await getOffProductByBarcode(r.barcode!);
    // Not found on OFF → store [] so we don't re-check it every run (still "unknown" → never hidden).
    const countries = off?.countries ?? [];
    await dbi.update(products).set({ countries }).where(eq(products.id, r.id));
    done++;
    if (done % 25 === 0) console.log(`  …${done}/${rows.length}`);
    await new Promise((res) => setTimeout(res, 150)); // be gentle on OFF
  }
  console.log(`Done — set markets on ${done}/${rows.length}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
