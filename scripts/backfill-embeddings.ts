// Backfill product embeddings for semantic search (SS2). One-off after applying migration 0010 and
// setting OPENAI_API_KEY. Embeds products that don't have a vector yet (or all, with --all).
//   npm run db:embeddings          # only missing embeddings
//   npm run db:embeddings -- --all # re-embed everything (e.g. after changing the embed text)
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env.development.local" });

import { eq, isNull } from "drizzle-orm";
import { db } from "../lib/db";
import { products } from "../lib/db/schema";
import { getProductForPage } from "../lib/db/queries/products";
import { embedTexts, productEmbeddingText, embeddingsEnabled } from "../lib/embeddings";

async function main() {
  const dbi = db();
  if (!dbi) {
    console.error("DATABASE_URL is not set — nothing to backfill.");
    process.exit(1);
  }
  if (!embeddingsEnabled()) {
    console.error("OPENAI_API_KEY is not set — embeddings are disabled. Set it and re-run.");
    process.exit(1);
  }

  const all = process.argv.includes("--all");
  const cols = { id: products.id, slug: products.slug, name: products.name, brand: products.brand };
  const rows = await (all
    ? dbi.select(cols).from(products)
    : dbi.select(cols).from(products).where(isNull(products.embedding)));

  if (rows.length === 0) {
    console.log("Nothing to embed (all products already have an embedding). Use --all to re-embed.");
    return;
  }
  console.log(`Embedding ${rows.length} product(s)…`);

  // Build the embed text per product (brand + name + summary + ingredient names), then one batch call.
  const texts: string[] = [];
  for (const r of rows) {
    const data = await getProductForPage(dbi, r.slug);
    texts.push(
      productEmbeddingText({
        name: r.name,
        brand: r.brand,
        summary: data?.summary ?? null,
        ingredientNames: data?.items.map((i) => i.name) ?? [],
      }),
    );
  }

  const embeddings = await embedTexts(texts);
  let done = 0;
  for (let i = 0; i < rows.length; i++) {
    const e = embeddings[i];
    if (!e) continue;
    await dbi.update(products).set({ embedding: e }).where(eq(products.id, rows[i].id));
    done++;
  }
  console.log(`Done — embedded ${done}/${rows.length}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
