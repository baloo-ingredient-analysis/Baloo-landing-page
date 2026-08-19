# Baloo — Architecture

> **This is the living technical reference.** When you ship something that changes the data model,
> the pipeline, a route, or an invariant, update the relevant section here in the same commit. Keep
> it descriptive (how the system *is*), not aspirational (that's `Baloo_Launch_Plan.md`). Append a
> line to [`CHANGELOG.md`](CHANGELOG.md) when a milestone lands.
>
> **Last updated:** 2026-07-20 (after `9eb4c97`, security plan). Reflects Phases 1–3 shipped.

---

## 1. What Baloo is, technically

A **Next.js 15 (App Router)** web app on Vercel. Two layers on one codebase:

1. **The tool** (Phases 1–2) — URL → scraped page → Claude extraction → streamed per-ingredient
   analysis + nutrition context. Stateless; works with just two API keys.
2. **The community platform** (Phase 3) — accounts, a deduplicated **product catalog**, shareable
   **lists**, public **profiles**, **discovery/search**, **follows/feed**, **saves/votes**,
   **comments**, and **moderation**, all on **Postgres (Supabase)** via **Drizzle**.

**The optional-infrastructure rule (load-bearing).** The app must boot and serve with *every*
external service absent. Each integration degrades to a silent no-op when its env vars are missing:
no `DATABASE_URL` → `db()` returns `null` and the community features disappear; no Redis → no cache;
no `ANTHROPIC_API_KEY` → the mock pipeline (or a friendly error). This keeps local dev and CI trivial
and prevents a missing key from taking the site down. **Preserve it in every new integration.**

**Portability.** Everything in `lib/` avoids `next/*` imports where practical (see `lib/analysis/`)
so the future mobile app can reuse the pipeline. Route handlers are the only Next-coupled layer.

---

## 2. The analysis pipeline

```
URL ─▶ Firecrawl (/v2/scrape, markdown) ─▶ Claude generateObject (extract) ─▶ Claude streamObject (analyse)
```

| Step | Where | Notes |
|---|---|---|
| Validate URL, check caches | `app/api/extract/route.ts` | L1 Redis (URL) → L2 Postgres (identity) → scrape |
| Scrape → markdown | `lib/firecrawl.ts` | REST call to Firecrawl `/v2/scrape` (SDK avoided to dodge version drift) |
| Extract header + ordered ingredients | `lib/analysis/pipeline.ts` `scrapeAndExtract()` | `generateObject(extractionSchema)` |
| Per-ingredient analysis (streamed) | `app/api/analyze/route.ts` | `streamObject(analysisSchema)` → client via `experimental_useObject` |
| Per-ingredient analysis (background) | `lib/analysis/pipeline.ts` `analyseIngredients()` | non-streaming `generateObject`, for the catalog engine |
| Persist to catalog | `lib/ingest.ts` `ingestAnalysis()` | dedupe on canonical key; write product + ingredients + offer |

**Client orchestration** (`app/page.tsx`): call `/api/extract` first ("Reading ingredients…"), then
stream `/api/analyze` ("Analysing with AI…"). Ingredient order is **label order** (most-to-least by
quantity) and is never re-sorted.

**`ANALYSIS_MAX_TOKENS = 16000`** (`lib/config.ts`) — the Anthropic provider defaults to 4096 output
tokens; a long ingredient list hits `finishReason: 'length'`, the object never validates, and because
the catalog write runs inside `after()` the whole analysis is silently lost. Both the streaming and
background paths set this explicitly. **Don't remove it.**

**Failure contract:** every failure shows **one** friendly message, never a raw error —
> "We couldn't read that page. Try a direct product link from Whole Foods, Ocado, Tesco, Target, or Kroger."

### Two-layer cache

| Layer | Store | Key | Skips | Set in |
|---|---|---|---|---|
| **L1** | Upstash Redis | `hashUrl(url)`, 7-day TTL | *everything* (scrape + extract + analyse) | `lib/cache.ts` |
| **L2** | Postgres catalog | `canonical_key` (identity) | the expensive per-ingredient **analyse** | `app/api/extract/route.ts` short-circuit |

Identity is only knowable *after* scraping, so L2 can never skip Firecrawl — that's L1's job. A second
retailer for a known product costs one scrape+extract, **zero** analyse calls, and gains an offer.

---

## 3. Data model (Postgres / Drizzle)

Source of truth: [`lib/db/schema.ts`](../lib/db/schema.ts). Migrations generated into `drizzle/`
(`0000`–`0007`). Client is **lazy**: `db()` in [`lib/db/index.ts`](../lib/db/index.ts) returns `null`
without `DATABASE_URL`. Connects as `postgres` (via the transaction pooler, `prepare: false`), which
**bypasses RLS** — so API routes enforce auth in code; RLS is defence-in-depth for any client path.

**Enums:** `ingredient_tag` (Natural | Processed) · `nutrition_per` (100g | serving | both) ·
`analysis_status` (pending | analysing | done | failed).

### Tables (15)

**Catalog**
- `products` — one row per *real* product. Dedupes on **`canonical_key`** (barcode, else normalised
  brand+name+size — see `lib/canonical.ts`). Holds `slug`, `summary`, `analysis_status`, `analysed_at`,
  `category`.
- `offers` — retailer listings of a product (many→one). Unique on (product, retailer, url); powers
  "also available at". RLS-enabled, public read.
- `ingredients` — **product-independent** cache of `what_it_is` (an ingredient means the same thing
  everywhere).
- `ingredient_profiles` / `ingredient_profile_items` — the **per-product** analysis, **versioned**
  (`is_active` flags the current one; never deleted). `why_its_here` + `role` live here.
- `nutrition` — the panel captured verbatim (values as printed, never computed).

**Identity & social**
- `profiles` — `id` is a **FK to `auth.users.id`** (Supabase Auth). Handle, display name, `is_admin`.
- `lists` / `list_items` — user-curated collections; `slug`, public/private, ordered items.
- `follows` · `saves` · `votes` — the social graph and signals. Lists carry **two** signals
  (Order L8): a **Like** (public — a `votes` row with `target_type = 'list'`; count shown, feeds
  Popular/Explore ranking) and a **Save** (private — a `saves` row; goes to the owner's library, count
  NEVER shown publicly, used only as an internal ranking signal). **Products carry no like/save** —
  their one action is "Add to my list". Comment votes remain agreement (the thread's "Top" sort).
  "Popular this week" ranks by likes; Discover/Explore blends likes + saves(internal) + recency +
  regional availability (L7). Likes deliberately write no feed activity.
- `product_saves` — the **Pantry** (Order PP1, `profile-page` branch): a private collection of saved
  PRODUCTS (`userId`,`productId`, PK), separate from `saves` (saved lists). **Owner-only RLS** — no one
  sees another's pantry. Surfaces on the profile's Pantry tab; products keep BOTH "Save to pantry" and
  "Add to my list".
- `comments` — threaded; soft-hidden via `hidden_at`/`hidden_by` (moderation tombstones).

**Account deletion — "erase the person, keep the community" (Order S7a).** Everything hanging off
`profiles` cascades, *except* two deliberate exceptions (migration `0008`): `lists.owner_id` and
`comments.user_id` are **nullable + `ON DELETE SET NULL`**. So deleting an account removes the auth
user (email/password), the profile, saves, follows, votes, activity and reports — while **public
lists survive ownerless** (rendered "by a Baloo user") and **comments survive as scrubbed
tombstones**, which keeps other people's replies from being cascaded away with them. `lib/account/
delete.ts` is order-sensitive: private lists deleted and comments scrubbed *while the owner is still
known*, then the auth user last. Security: `owner_id = auth.uid()` is never true for `NULL`, so an
orphaned list is editable by nobody — the RLS policies needed no change. **Do not restore these two
FKs to `CASCADE`** without re-reading that file.
- `activity` — append-only event log (`verb` + `meta` jsonb) powering the feed **and** the seed for
  notifications.
- `reports` — user reports feeding the moderation queue.

**Two invariants that must hold:**
1. Products converge on **one row per real product** (`canonical_key`).
2. `what_it_is` is cached **product-independently**; `why_its_here`/`role` are **per-product**.

---

## 4. Route & API surface

### Pages (`app/**/page.tsx`)

| Route | Purpose |
|---|---|
| `/` | The tool — paste → extract → stream; idle homepage board |
| `/p/[slug]` | Canonical product page (stored analysis, reuses `ResultsView`) |
| `/discover` | Explore — ranked public lists from people you don't follow (Following lives at `/feed`) + search |
| `/u/[handle]` | Profile (curator landing) — Pantry (owner-only, PP2) + Lists (own + saved) tabs; `/lists` redirects here |
| `/list/[slug]` · `/list/[slug]/edit` | Public list · list editor |
| `/lists` · `/lists/new` | My lists · create |
| `/feed` | Following feed |
| `/welcome` | Handle setup after signup |
| `/admin` | Moderation queue (admin only) |

### API (`app/api/**/route.ts`)

| Group | Routes |
|---|---|
| **Pipeline** | `extract`, `analyze`, `products/analyze` (background/retry engine), `products/search` |
| **Content** | `lists`, `lists/[id]`, `lists/[id]/items`, `search` (hybrid: pgvector semantic + keyword), `board`, `nutrition-context`, `explain` (AI "explain this") |
| **Social** | `saves`, `votes`, `follows`, `comments`, `feed` |
| **Moderation** | `reports`, `moderation` |
| **Identity** | `me`, `profile`, `auth/callback` |
| **Marketing** | `subscribe` (Loops) |
| **Mobile API (v1)** | `v1/ping`, `v1/analyse-ingredients`, `v1/find-product` — service-key gated (`lib/apiAuth`, fail-closed) for the mobile app; contract in `docs/API_CONTRACT_V1.md` |

**Semantic search (SS):** products carry an `embedding vector(1536)` (OpenAI `text-embedding-3-small`,
migration 0010, pgvector + HNSW cosine). `/api/search` embeds the query and `searchAll` fuses the
pgvector nearest-neighbours with the keyword hits via reciprocal-rank fusion. Optional-infra:
keyword-only without `OPENAI_API_KEY`. Depth in `docs/SEMANTIC_SEARCH.md`.

**Open Food Facts catalog source (OFF):** scraping retailer sites is a dead end (they block us and
never publish the barcode — tested), so the catalog is filled from **Open Food Facts** instead.
`lib/openfoodfacts.ts` looks products up by barcode (`/api/v2/product`) or name (search-a-licious) and
maps them to our shapes (English-preferring ingredients, canonical nutrition). `lib/offImport.ts`
runs the existing `analyseIngredients` on OFF's ingredient list (skipping scrape+extract) and persists
via `ingestAnalysis` (canonical_key = barcode; known products reused). `/api/off/lookup` is the web's
search-miss path (name/barcode → import → product slug), surfaced by `SearchBox` when the catalog has
no match; `npm run db:seed-off` bulk-imports popular products. Optional-infra: OFF unreachable → search
just serves the existing catalog. ODbL (attribution; legal sign-off before paid/B2B use). Depth in
`docs/OFF_CATALOG.md`.

---

## 5. Auth & authorization

**Provider: Supabase Auth (GoTrue)** — a managed third-party service. We never store or hash
passwords. Clients: `lib/supabase/client.ts` (browser) + `lib/supabase/server.ts` (SSR cookies via
`@supabase/ssr`). Methods shipped: email+password (with confirmation), Google OAuth, and anonymous
("guest") sign-in with an upgrade path.

**Server gates** (`lib/auth.ts`): `getSessionUser()` · `requireUser()` → 401 (any signed-in, incl.
guest) · **`requireVerifiedUser()` → 403 `verify_required`** (a real, non-anonymous account) ·
`requireAdmin()` → 403 · `getCurrentProfile()`. **Reads are public.** Writes split (Order S2, the
*guests analyse-only* rule): the paste-flow analysis is open; every **community write** (lists,
comments, follows, votes, saves, reports, `products/analyze`) requires `requireVerifiedUser()`; a
user's own delete/toggle-off stays `requireUser()`. Client controls call `useAuthGate()` to prompt
sign-in (401) or upgrade (403). Because server Drizzle bypasses RLS, these code checks — not RLS —
are the real enforcement.

**Rate limiting** (Order S1, `lib/ratelimit.ts`): sliding-window limits on the paid routes —
extract/analyze/nutrition-context by IP, explain/products-analyze by user — returning a friendly 429.
Optional-infra (fail-open without Upstash), so **inert until `UPSTASH_REDIS_REST_URL/TOKEN` are set**.

**Security headers** (Order S5, `next.config.mjs` `headers()`, all routes): HSTS · X-Frame-Options
DENY · X-Content-Type-Options nosniff · Referrer-Policy · Permissions-Policy are **enforcing**; CSP
ships **report-only** (`connect-src` carries the Supabase origin from env). Report-only is currently
clean (no violations), so flipping to enforcing later is low-risk.

**Profile visibility** (Order L5c): a profile is public only once it has ≥1 public list. `/u/[handle]`
`notFound()`s for non-owners of a 0-public-list profile and its metadata goes generic; owners always
see their own (with a "publish to go public" nudge). Discovery surfaces already enforce this (search
returns no profiles; `getSuggestedCurators` inner-joins public lists).

> **Still planned (S-series, `Baloo_Launch_Plan.md`):** captcha/Turnstile (deferred — Cloudflare +
> Supabase setup), write volume caps (S4), security headers + WAF (S5), monitoring (S6), account
> deletion + unsubscribe (S7).

---

## 6. Nutrition (Phase 2)

- Extraction captures the panel **verbatim**; empty when a page has none.
- **All arithmetic is in code** (`lib/nutrition.ts`) — the model never calculates, only phrases
  numbers computed in code. A deterministic fallback sentence covers model errors.
- Reference intakes: UK RIs in `lib/profile.ts` (PHE 2016 + NHS front-of-pack). Presets only, stored
  in localStorage, no accounts.
- **No score, no nutrient colour-coding, no good/bad verdicts.** Context, not judgment. Disclaimer
  always shown. Context line cached per product×profile via `/api/nutrition-context`.

---

## 7. Directory map

```
app/            routes (pages + api); layout.tsx; page.tsx = the tool
components/      UI — grouped: auth/ lists/ engagement/ feed/ discover/ admin/ + top-level cards
lib/
  analysis/      pipeline.ts, runForProduct.ts (background engine), stored.ts  ← framework-agnostic
  db/            schema.ts (source of truth), index.ts (lazy client), queries/*  ← one file per table group
  supabase/      client.ts (browser), server.ts (SSR)
  auth.ts        requireUser / requireAdmin gates
  ingest.ts      canonical dedupe + catalog write
  canonical.ts   canonical_key normalisation      slug.ts / cover.ts   list slugs + covers
  schema.ts      Zod schemas for extract/analyse   prompts.ts           the nutritionist prompt
  firecrawl.ts   REST scrape                        cache.ts / hash.ts   L1 Redis
  nutrition.ts   all nutrition maths               profile.ts           UK reference intakes
  stats.ts       fire-and-forget scan logging (homepage board)          config.ts  model + limits
  region.ts      retailer→region availability math (Order L7) — Discover soft-ranks by "% you can buy"
drizzle/         0000–0007 migrations + 0001_rls.sql (RLS policies)
scripts/         seed-dev.ts · check-db.ts · make-admin.ts
docs/            ARCHITECTURE.md (this) · CHANGELOG.md · templates/ · archive/
```

**Conventions:** one query file per table group in `lib/db/queries/`; every mutating API route opens
with a `requireUser()`/`requireAdmin()` gate; fire-and-forget side effects (scan logging, catalog
ingest) run in `after()` and never block or break the user flow; new external services follow the
optional-infra rule (guard on the env var, no-op when absent).
