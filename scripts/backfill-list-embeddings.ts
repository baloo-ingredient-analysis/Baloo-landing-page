// Backfill embeddings for public lists (L3 — semantic list search). One-off after the migration that
// adds lists.embedding, and whenever OPENAI_API_KEY is newly set. Embeds title + description.
//   npm run db:list-embeddings          # only public lists missing an embedding
//   npm run db:list-embeddings -- --all # re-embed every public list (e.g. after changing the text)
//
// Only PUBLIC lists are embedded — private lists never surface in search.
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env.development.local" });

import { and, eq, isNull } from "drizzle-orm";
import { db } from "../lib/db";
import { lists } from "../lib/db/schema";
import { embedTexts, listEmbeddingText, embeddingsEnabled } from "../lib/embeddings";

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
  const cols = { id: lists.id, title: lists.title, description: lists.description };
  const rows = await (all
    ? dbi.select(cols).from(lists).where(eq(lists.isPublic, true))
    : dbi.select(cols).from(lists).where(and(eq(lists.isPublic, true), isNull(lists.embedding))));

  if (rows.length === 0) {
    console.log("Nothing to embed (every public list already has one). Use --all to re-embed.");
    return;
  }
  console.log(`Embedding ${rows.length} public list(s)…`);

  const texts = rows.map((r) => listEmbeddingText({ title: r.title, description: r.description }));
  const embeddings = await embedTexts(texts);
  let done = 0;
  for (let i = 0; i < rows.length; i++) {
    const e = embeddings[i];
    if (!e) continue;
    await dbi.update(lists).set({ embedding: e }).where(eq(lists.id, rows[i].id));
    done++;
  }
  console.log(`Done — embedded ${done}/${rows.length}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
