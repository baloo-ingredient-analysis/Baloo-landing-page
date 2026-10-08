// Backfill auto-generated tags + discovery for existing lists (AEO + tags track). Re-runnable; a list
// with no product signal + no key just stays null. Run: npm run db:list-meta
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env.development.local" });
import { db } from "../lib/db";
import { lists } from "../lib/db/schema";
import { generateAndStoreListMeta } from "../lib/db/queries/lists";

async function main() {
  const dbi = db();
  if (!dbi) {
    console.error("No DB — run `npx vercel env pull .env.development.local` first.");
    process.exit(1);
  }
  const rows = await dbi.select({ id: lists.id, title: lists.title }).from(lists);
  console.log(`generating tags + discovery for ${rows.length} lists…\n`);
  let done = 0;
  for (const r of rows) {
    try {
      await generateAndStoreListMeta(dbi, r.id);
      done++;
      console.log(`  ✓ ${r.title}`);
    } catch (e) {
      console.error(`  ✗ ${r.title}`, e);
    }
  }
  console.log(`\ndone: ${done}/${rows.length}`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
