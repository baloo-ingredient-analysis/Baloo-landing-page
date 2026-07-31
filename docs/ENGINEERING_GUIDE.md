# Baloo — Engineering Guide

> How Baloo is built, for a developer picking it up: the stack, the pipeline, the data model, auth &
> security, the conventions, and the decisions behind them.
>
> This is a **consolidated companion**. The authoritative, always-current references are
> [`README.md`](../README.md) (run it / deploy it), [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) (living
> technical reference — data model, pipeline, routes, auth, caching), and
> [`docs/PROJECT_EXPLAINED.md`](PROJECT_EXPLAINED.md) (plain-language walkthrough + decisions). If this
> guide and those disagree, they win.

**The one hard rule:** the catalog write, the cache, and the scan log may *never* slow or break the
user flow. Side effects run fire-and-forget in `after()`; every external service degrades to a no-op
when absent. The paste-flow works with two API keys and nothing else.

---

## 1 · What it is, technically

A **Next.js 15 (App Router)** web app on Vercel — two layers on one codebase:

1. **The tool** (Phases 1–2) — URL → scraped page → Claude extraction → streamed per-ingredient
   analysis + nutrition context. Stateless; two API keys.
2. **The community platform** (Phase 3) — accounts, a deduplicated product **catalog**, shareable
   **lists**, profiles, discovery/search, follows/feed, saves/likes, comments, moderation — on
   **Postgres (Supabase)** via **Drizzle**.

---

## 2 · The stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 · App Router · React 18 | Server components + route handlers; `after()` for fire-and-forget. |
| Language / styling | TypeScript · Tailwind v3 | `tsc --noEmit` is the type gate; tokens in `tailwind.config.ts`. |
| AI | AI SDK v4 (`ai` ^4, `@ai-sdk/anthropic`) · `claude-sonnet-4-6` | `generateObject` (extract) · `streamObject` + `experimental_useObject` (analyse). **Pinned to v4** — import paths shift on v5. |
| Scraping | Firecrawl `/v2/scrape` (REST) | Over REST, not the SDK, to dodge version drift (`lib/firecrawl.ts`). |
| Database | Postgres (Supabase) · Drizzle · postgres.js | Transaction pooler → **`prepare:false`**. Schema in `lib/db/schema.ts`. |
| Auth | Supabase Auth (GoTrue) · `@supabase/ssr` | Email+password, Google OAuth, anonymous guest. We never store passwords. |
| Cache / limits | Upstash Redis · `@upstash/ratelimit` | L1 URL cache + rate limiting. Optional (fail-open). |
| Monitoring | Sentry (`@sentry/nextjs`) | Guarded `if (DSN)` across all runtimes; inert without a DSN. |
| Hosting | Vercel · `@vercel/functions` | Geo + `after()`. CI (typecheck + build) on every push. |

---

## 3 · The analysis pipeline

Claude **is** the extraction layer — there are **no per-retailer CSS/regex parsers**, so a site
redesign never breaks Baloo.

```
URL
 └─▶ /api/extract            validate · L1 Redis · L2 catalog · else scrape
       └─▶ Firecrawl /v2/scrape         lib/firecrawl.ts → markdown
             └─▶ Claude generateObject  header + ORDERED ingredient list (label order, never re-sorted)
                   └─▶ /api/analyze      Claude streamObject → cards stream to the client
                         └─▶ after(): lib/ingest.ts   dedupe + persist to catalog (never blocks)
```

- **Client orchestration** (`app/page.tsx`): `/api/extract` first ("Reading ingredients…"), then
  stream `/api/analyze` ("Analysing with AI…").
- **Two homes, one prompt + schema.** The streaming path lives in the route; a framework-agnostic,
  resumable **engine** in `lib/analysis/` (`runAnalysisForProduct`) does background re-analysis. Both
  share one prompt (`lib/prompts.ts`) and one Zod schema (`lib/schema.ts`) — they can't drift.
- **`ANALYSIS_MAX_TOKENS = 16000`** (`lib/config.ts`) — the provider defaults to 4096; a long list
  hits `finishReason: 'length'`, the object never validates, and because the catalog write is in
  `after()` the analysis is **silently lost**. Both paths set it. **Don't remove it.**
- **Failure contract:** one friendly message, never a raw error — *"We couldn't read that page. Try a
  direct product link from Whole Foods, Ocado, Tesco, Target, or Kroger."*

### The two-layer cache

| Layer | Store | Key | Skips |
|---|---|---|---|
| **L1** | Upstash Redis | `hashUrl(url)`, 7-day TTL | **Everything** (scrape + extract + analyse). |
| **L2** | Postgres catalog | `canonical_key` (identity) | The expensive per-ingredient **analyse**. |

Identity is only knowable *after* scraping, so L2 can't skip Firecrawl — that's L1's job. A second
retailer for a known product costs one scrape+extract, **zero** analyse calls, and gains an `offer`.

---

## 4 · Data model

Source of truth: `lib/db/schema.ts`; migrations generated into `drizzle/` (`0000`–`0009`). One query
file per table group in `lib/db/queries/`. Lazy client `db()` returns `null` without `DATABASE_URL`.

- **Catalog:** `products` (deduped on `canonical_key`), `offers` (retailer listings, many→one),
  `ingredients` (product-independent `what_it_is` cache), `ingredient_profiles`/`_items` (per-product,
  versioned), `nutrition` (verbatim panel).
- **Identity & social:** `profiles` (FK → `auth.users.id`), `lists`/`list_items`, `follows`·`saves`·
  `votes`, `product_saves` (the private Pantry), `comments`, `activity`, `reports`.

**Two invariants that must hold:**
1. Products converge on **one row per real product** (`canonical_key` = barcode, else normalised
   brand+name+size — `lib/canonical.ts`).
2. `what_it_is` is cached **product-independently**; `why_its_here`/`role` are **per-product**.

**Account deletion — "erase the person, keep the community" (migration 0008).** Everything off
`profiles` cascades *except* `lists.owner_id` and `comments.user_id`, made **nullable +
`ON DELETE SET NULL`**. Deletion removes the auth user, profile, saves, follows, votes — while public
lists survive ownerless and comments survive as scrubbed tombstones (so other people's replies aren't
cascaded away). `lib/account/delete.ts` is order-sensitive. **Don't restore those FKs to CASCADE.**

---

## 5 · Auth & security

**Supabase Auth (GoTrue)** — managed; we never store/hash passwords. `profiles.id` FKs to
`auth.users.id` and RLS uses `auth.uid()`, so auth **must** live in our Postgres (this is why it isn't
Clerk/Auth0 — that would split auth from data and break RLS).

**Gates (`lib/auth.ts`):**
- `requireUser()` → 401 — any signed-in, incl. guest.
- `requireVerifiedUser()` → 403 `verify_required` — a real (non-anonymous) account; the
  **guests-analyse-only** wall on every community write.
- `requireAdmin()` → 403 — moderation.

Reads are public. **Server Drizzle bypasses RLS, so these code checks are the real enforcement;** RLS
(`drizzle/0001_rls.sql`) is defence-in-depth for any client/PostgREST/mobile path.

**Other layers:** rate limiting (sliding-window, `lib/ratelimit.ts`, fail-open without Upstash);
security headers (`next.config.mjs` — HSTS/X-Frame/nosniff/Referrer/Permissions enforcing, **CSP
report-only**); Sentry (`sendDefaultPii:false`).

**Honest gaps (tracked, S-series):** rate limiting is **inert in prod until the Upstash env vars are
wired**; CSP is still **report-only**; captcha/Turnstile + WAF are deferred.

---

## 6 · The optional-infrastructure rule

The most load-bearing convention. **The app boots and serves with every external service absent** —
each degrades to a silent no-op:

```
no DATABASE_URL      → db() returns null → community features disappear
no ANTHROPIC_API_KEY  → the mock pipeline (MOCK_PIPELINE=1) or a friendly error
no Redis              → no cache, no rate limit (fail-open)
no Supabase / Loops   → auth / email quietly off
```

Local dev and CI stay trivial (clone → `npm install` → `npm run dev`, zero env), and a missing/rotated
key can never take the site down. **Every new integration must follow it** — guard on the env var,
no-op when absent.

---

## 7 · Conventions & workflow

- `lib/` avoids `next/*` imports where practical — **portable for the eventual mobile app**; route
  handlers are the only Next-coupled layer.
- One query file per table group in `lib/db/queries/`.
- Every mutating route opens with a `requireUser()`/`requireVerifiedUser()`/`requireAdmin()` gate.
- Fire-and-forget side effects run in `after()` — never block/break the user flow.
- Every file opens with its **Order + the *why***; comments explain decisions, not syntax. (`0`
  TODO/FIXME/HACK in the tree.)
- **Rhythm:** plan → build → verify → **one commit per "Order"** → push; `ARCHITECTURE.md` +
  `CHANGELOG.md` move in the same change. Guardrails live in `CLAUDE.md`. CI = `tsc` + `next build`.

The git history reads as a clean sequence of Orders (A·B·C·D·F · G1–G9 · P1–P2 · L-series · S-series ·
PP1–PP4), each a single reviewable commit.

---

## 8 · Verification & the test gap

**In place:** `tsc --noEmit` (primary gate, CI) · `next build` (SSR/route breakage, CI) · **Vitest
unit tests** (`npm test`, CI) · read-only DB assertions (`scripts/check-db.ts`) · live browser DOM
verification in dev · a deterministic **mock pipeline** (`MOCK_PIPELINE=1`).

**Unit tests — scaffolded.** Vitest (`vitest.config.ts`, scoped to `lib/**/*.test.ts`) with **31
tests** over the pure, framework-agnostic layer: `canonical` (the dedup/slug invariants), `hash` (URL
cache key), `slug`, `region` (availability math), `retailers` (URL detection/validation + region
mapping). Runs in CI between typecheck and build.

**Still planned (the next investment):**
1. Extend units to `nutrition.ts` (the arithmetic + highlight selection).
2. **Integration tests** on `lib/db/queries/*` against a throwaway Postgres.
3. A couple of **Playwright smoke tests**: the paste-flow (mocked) + a signed-in list build.

---

## 9 · Repo map & running it

```
app/            routes (pages + api); page.tsx = the tool
components/      UI — auth/ lists/ engagement/ feed/ discover/ profile/ admin/
lib/
  analysis/      pipeline.ts · runForProduct.ts (bg engine) · stored.ts   ← framework-agnostic
  db/            schema.ts (truth) · index.ts (lazy client) · queries/* (one per table group)
  supabase/      client.ts (browser) · server.ts (SSR cookies)
  auth · ingest · canonical · prompts · schema · firecrawl · cache · nutrition · profile
  region · ratelimit · config · stats · cover · slug · hash
drizzle/         0000–0009 migrations + 0001_rls.sql
scripts/         seed-dev · seed-supply · check-db · make-admin
docs/            ARCHITECTURE · PROJECT_EXPLAINED · CHANGELOG · DESIGN_GUIDE · archive/
```

```bash
npm install
cp .env.example .env.local   # all keys optional to boot
npm run dev                  # :3000 — MOCK_PIPELINE=1 for the full flow, no spend
```

Scripts: `db:generate` (migration from schema) · `db:migrate` · `db:seed` / `db:seed-supply` ·
`db:check` · `typecheck` · `build` · `lint`.

**Read order for a newcomer:** `README.md` → `docs/ARCHITECTURE.md` → `docs/PROJECT_EXPLAINED.md` →
`lib/db/schema.ts` → `app/api/extract` + `app/api/analyze`.

---

## 10 · Decisions & the why

| Decision | Why |
|---|---|
| **Claude is the extraction layer — no per-retailer parsers** | One model reads any retailer's markdown; a site redesign never breaks a scraper. The explanation is the product, not the parsing. |
| **Supabase Auth, not Clerk/Auth0** | `profiles.id` FKs to `auth.users.id`; RLS uses `auth.uid()`. Auth must live in our Postgres. |
| **Optional-infra everywhere** | Boots with zero env; no key can take the site down; local dev & CI stay trivial. |
| **One prompt + one schema, two runtimes** | Streaming route and the background engine share them, so analysis can't drift. |
| **Catalog write in `after()`** | Persistence is a side effect of a successful analysis — it must never slow or break the stream. |
| **Likes reuse the polymorphic `votes` table** | Re-adding list Likes (L8) needed **no migration**; the table already supported `target_type='list'`. |
| **Nutrition verbatim · all arithmetic in code** | The model never calculates — only phrases numbers computed in `lib/nutrition.ts`. Accuracy + the no-score ethos. |
| **Transaction pooler → `prepare:false`** | Supabase's pooler (PgBouncer transaction mode) doesn't support prepared statements. |

---

## 11 · Where things stand & next

- **Shipped:** the tool (Phases 1–2) is live; the community platform (Phase 3) is built and hardening
  toward a beta (`Baloo_Launch_Plan.md`).
- **On the `profile-page` branch (not yet merged):** the product Pantry, the Pinterest-style profile
  (Pantry + Lists), Discover → Explore, public Likes, nav line-icons, and recent fixes (modal portal,
  share icons). Review the newest work on this branch.

**Top engineering priorities to discuss:**
1. **A test suite** — pure `lib/` units first, then query integration + a Playwright smoke path.
2. **Wire Upstash on Vercel** so rate limiting is actually enforcing in prod.
3. **Flip the CSP to enforcing** (report-only is clean) once a report endpoint exists; add WAF/captcha.
4. **Merge `profile-page`** once reviewed.

_Living references: [`README.md`](../README.md) · [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) ·
[`docs/PROJECT_EXPLAINED.md`](PROJECT_EXPLAINED.md) · [`docs/CHANGELOG.md`](CHANGELOG.md) ·
[`CLAUDE.md`](../CLAUDE.md)._
