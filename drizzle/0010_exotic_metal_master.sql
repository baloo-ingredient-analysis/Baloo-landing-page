-- Semantic search (SS1). pgvector installed in public to match pg_trgm (0006), so the unqualified
-- `vector` type resolves. Additive + nullable: existing rows are untouched, NULL embeddings simply
-- don't match semantic queries (keyword search still covers them). Drizzle generated the ALTER +
-- index; the CREATE EXTENSION is hand-added (Drizzle doesn't manage extensions).
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_embedding_idx" ON "products" USING hnsw ("embedding" vector_cosine_ops);
