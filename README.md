# Baloo

**Know what's in your food.** Search a product by name — or paste a supermarket link — and Baloo
returns a calm, plain-language breakdown of every ingredient: what it is, why it's in *that* product, a
Natural/Processed tag, and any listed %. The homepage **is** a search engine over a catalog filled from
[Open Food Facts](https://world.openfoodfacts.org) (retailer scraping is a dead end — most sites block
us or don't publish the barcode). From there, products can be saved into shareable lists and discovered
through the people who curate them.

Baloo **explains, it never scores.** No health score, no rating, no traffic lights — ever. That
guardrail is the whole point, and it's enforced in [`PRODUCT.md`](PRODUCT.md) and
[`DESIGN.md`](DESIGN.md).

> **Status:** the ingredient tool (Phases 1–2) is live and the community platform (Phase 3 —
> accounts, lists, profiles, discovery, comments, moderation) is built and being hardened toward a
> beta. See [`Baloo_Launch_Plan.md`](Baloo_Launch_Plan.md) for what's next.

---

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in keys (see below); all are optional to boot
npm run dev                  # http://localhost:3000
```

The app **boots with zero environment variables** — every piece of infrastructure (Claude,
Firecrawl, Redis, Postgres, email) is optional in code. With no keys you get the full UI; set
`MOCK_PIPELINE=1` to walk the whole reading → streaming → results flow without spending anything. Add
keys to switch on the real pipeline and the community features.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` (also runs in CI on every push) |
| `npm test` | Unit tests (Vitest) over the pure `lib/` layer — runs in CI |
| `npm run db:generate` | Generate a Drizzle migration from `lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |
| `npm run db:seed` | Seed demo data (products, users, lists) |
| `npm run db:seed-off` | Bulk-import popular products from Open Food Facts (dry-run by default) |
| `npm run db:embeddings` | Backfill product embeddings for semantic search (needs `OPENAI_API_KEY`) |
| `npm run db:list-embeddings` | Backfill public-list embeddings for semantic list search (needs `OPENAI_API_KEY`) |
| `npm run db:countries` | Backfill `products.countries` (sales markets) from OFF — powers the ES/UK gate |
| `npm run db:check` | Read-only assertions against the live DB |

## Environment variables

All server-side unless noted. Full annotated list in [`.env.example`](.env.example).

| Variable | Needed for | Optional? |
|---|---|---|
| `ANTHROPIC_API_KEY` | Ingredient analysis (Claude) | Required for live analysis |
| `FIRECRAWL_API_KEY` | Scraping product pages | Required for live analysis |
| `DATABASE_URL` | Postgres (accounts, lists, catalog) | Optional — no DB → tool-only mode |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | Supabase Auth (client) | Public **by design** (safety is RLS, not key secrecy) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side ingestion/admin | Optional (with `DATABASE_URL`) |
| `OPENAI_API_KEY` | AI semantic search embeddings (`text-embedding-3-small`) | Optional — keyword-only search without it |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | URL cache + the homepage board | Optional |
| `LOOPS_API_KEY` | Email capture | Optional |

**Never** prefix a secret with `NEXT_PUBLIC_`. The two Supabase `NEXT_PUBLIC_` vars are the single
deliberate exception — the Supabase model makes them public and relies on Row-Level Security.

## How it works (at a glance)

**Primary — search (Open Food Facts catalog):**
```
Search text ─▶ /api/search ─▶ catalog (pgvector semantic + keyword) + live OFF candidates
                   │            ─▶ general filters: dedup · ES/UK market gate · relevance rank
                   ▼
             pick a result ─▶ known → product page instantly
                           ─▶ OFF candidate → /api/off/lookup ─▶ analyse once ─▶ product page
```

**Secondary — paste a link (for name/image; retailer scraping mostly blocked):**
```
Paste URL ─▶ /api/extract ─▶ Firecrawl scrape ─▶ Claude extract ─▶ /api/analyze (Claude streamObject)
                  │                                                         │
          (L1 Redis cache, URL-keyed · L2 Postgres, identity-keyed)  cards stream to the client
```

A successful analysis is stored **once** per real product (deduped on a canonical key) and reused
everywhere — the product page, other retailers' listings, and any list it's added to. The full model
(including the search-quality filters) is documented in **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)**.

## Documentation map

| Doc | What it's for | Cadence |
|---|---|---|
| **This README** | Front door: run it, deploy it, find things | Update on setup/structure changes |
| [`docs/PROJECT_EXPLAINED.md`](docs/PROJECT_EXPLAINED.md) | **Plain-language walkthrough of the whole project + every decision and why** (good for onboarding / explaining to others) | Update on major decisions |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | **Living technical reference** — data model, pipeline, API + route surface, auth, caching | **Update as features land** |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Running record of shipped milestones | Append when work ships |
| [`CLAUDE.md`](CLAUDE.md) | Rules + guardrails for AI-assisted work | Update when rules change |
| [`PRODUCT.md`](PRODUCT.md) / [`DESIGN.md`](DESIGN.md) | Strategy + visual system (the score-free guardrail) | Update on brand/design shifts |
| [`Baloo_Launch_Plan.md`](Baloo_Launch_Plan.md) | The beta launch track (L-series + S-series security) | The active plan |
| [`Baloo_Checklist.md`](Baloo_Checklist.md) | Pending work across every phase | Living checklist |
| [`Baloo_Phase3_Build_Orders.md`](Baloo_Phase3_Build_Orders.md) · [`_ProductOffer_Reconciliation.md`](Baloo_Phase3_ProductOffer_Reconciliation.md) | Phase 3 spec + current plan | Reference |
| [`docs/archive/`](docs/archive/) | Superseded handoffs, benchmark, old guides | Historical |

## Deploy (Vercel)

```bash
npx vercel            # link/create the project
npx vercel --prod     # deploy (env vars via the dashboard)
```

Add caching from **Vercel → Marketplace → Upstash Redis** (it injects the Upstash vars). Connect
**baloo.life** under Domains once the launch checks in [`Baloo_Checklist.md`](Baloo_Checklist.md)
pass. CI (typecheck + build) runs on every push via [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Notes

- Model `claude-sonnet-4-6`, set in [`lib/config.ts`](lib/config.ts).
- Pinned to the **AI SDK v4** line (`ai` ^4, `@ai-sdk/*` ^1); see [`CLAUDE.md`](CLAUDE.md) before upgrading.
- The `lib/` pipeline is deliberately framework-agnostic so a future mobile app can reuse it.
