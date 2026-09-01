ALTER TABLE "lists" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lists_embedding_idx" ON "lists" USING hnsw ("embedding" vector_cosine_ops);