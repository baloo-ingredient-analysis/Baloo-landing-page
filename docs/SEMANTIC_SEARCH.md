# Semantic search (SS)

Search by **meaning**, not just keywords: "dairy-free milk" finds an oat drink, "sugary kids cereal"
finds high-sugar cereals — while "oatly" still nails the exact brand. Hybrid: pgvector semantic
results fused with the existing keyword (ILIKE) results.

## How it works

```
query ──▶ embed (OpenAI text-embedding-3-small, 1536-d)
              │
              ▼
   products.embedding  <=>  query vector   (pgvector cosine, HNSW index)   ─┐
                                                                            ├─▶ reciprocal-rank
   products.name / brand  ILIKE  '%query%'  (keyword, as before)          ─┘   fusion → results
```

- **Storage:** `products.embedding vector(1536)` + an HNSW cosine index (migration 0010, pgvector).
- **Populate:** on every ingest (`lib/ingest.ts`, best-effort, non-blocking) the product is embedded
  from `brand + name + summary + ingredient names`; `scripts/backfill-embeddings.ts` does existing
  rows. NULL embeddings simply don't match semantically (keyword still covers them).
- **Query:** `/api/search` embeds the query and passes it to `searchAll`, which fuses semantic +
  keyword product hits with **reciprocal-rank fusion** (an item strong in *either* ranks well). A
  cosine-distance cutoff (`SEMANTIC_MAX_DISTANCE = 0.5`) drops clearly-unrelated hits. Lists stay
  keyword-only.
- **Provider:** OpenAI embeddings via the AI SDK (`@ai-sdk/openai`), isolated in `lib/embeddings.ts`
  so it's swappable (Voyage/Cohere). Claude has no embeddings API, so this is the one OpenAI
  touchpoint on the web.

## Optional-infra (the usual rule)

No `OPENAI_API_KEY` → `embeddingsEnabled()` is false → the query isn't embedded, `searchAll` runs
**keyword-only**, exactly as before. Embedding errors are swallowed to `null`. So the feature is
completely inert (not broken) until switched on — nothing to spend, nothing to fail.

## Turn it on (2 steps)

1. **Set `OPENAI_API_KEY`** in `.env.local` (local) and in Vercel (Production + Preview).
2. **Backfill existing products:**
   ```bash
   npm run db:embeddings          # embeds products missing a vector
   npm run db:embeddings -- --all # re-embed everything (after changing the embed text)
   ```
New products embed automatically on ingest from then on.

## Cost & limits

- `text-embedding-3-small` ≈ **$0.02 / 1M tokens** — a product or a query is a handful of tokens, so
  both backfill and per-search embedding are effectively free at this scale.
- The `/api/search` route is rate-limited (`search`, 30/min per IP) **only when embeddings are on**
  (it's the paid call). Inert without Upstash, like the other limiters.

## Notes / future

- Migration 0010 installs `vector` in `public` (matching `pg_trgm`); the advisor's
  `extension_in_public` WARN is the same benign lint pg_trgm already carries.
- `/discover` SSR search stays keyword-only for now (no per-page-load embed); the live SearchBox
  (`/api/search`) is the semantic path. Easy to extend later.
- Tune `SEMANTIC_MAX_DISTANCE` and the fusion once there's real catalog volume.
