# Baloo — ingredient tool + community platform

## What this is
A Next.js (App Router) web tool on baloo.life. The user pastes a supermarket product URL, hits
Analyse, and gets a streamed, per-ingredient breakdown: what each ingredient is, why it's in this
product, a Natural/Processed tag, and any listed %. The homepage IS the tool — no separate landing
and app pages. This is the prototype for a future mobile app; keep the pipeline portable. On top of
the tool sits the Phase 3 community platform (accounts, catalog, lists, profiles, discovery).

**Living technical reference: `docs/ARCHITECTURE.md`** — the current data model, pipeline, route/API
surface, auth, and caching. Keep it (and `docs/CHANGELOG.md`) up to date as features land.

## Design context
The design system lives at the repo root: `PRODUCT.md` (strategic — register/users/positioning and
the design principles, incl. the unbreakable score-free guardrail) and `DESIGN.md` (visual — tokens,
the "Quiet Field Guide" north star, named rules; machine layer in `.impeccable/design.json`). The
`/impeccable` skill drives design/UI work and reads both. To change the design context, edit those
root files; blank skeletons to reset or seed new ones are in `docs/templates/`.

## Pipeline (do not deviate without flagging)
`URL → Firecrawl (markdown) → Claude extract → Claude analyse → stream cards`
- /api/extract  — validate URL, check cache, Firecrawl scrape, Claude `generateObject` extract.
                  Returns a full cached result OR the header + ordered ingredient list.
- /api/analyze  — Claude `streamObject` per-ingredient analysis; streams to the client; writes the
                  finished result to cache on completion.
- /api/subscribe — email → Loops (graceful if not configured).
- app/page.tsx  — client orchestrator: extract first ("Reading ingredients…"), then stream analyse
                  via `experimental_useObject` ("Analysing with AI…").
- Catalog write — after a successful analysis, `lib/ingest.ts` persists it to Postgres (product
                  deduped on `canonical_key` + ingredients + offer) in `after()`; the product page
                  (`/p/[slug]`) and lists reuse it. `/api/extract` also short-circuits: a KNOWN
                  product (analysis done) returns the stored result and records a new offer, skipping
                  the expensive analyse. NEVER let the catalog write block or break the user flow.
- Two homes for the pipeline — streaming (`streamObject`) in the route for the paste flow, and a
                  framework-agnostic, resumable engine in `lib/analysis/` (`runAnalysisForProduct`)
                  for background re-analysis. Both share ONE prompt + schema.

## Hard rules
- Secrets are SERVER-SIDE env vars only: ANTHROPIC_API_KEY, FIRECRAWL_API_KEY, DATABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY, UPSTASH_REDIS_REST_URL/TOKEN, LOOPS_API_KEY, OPENAI_API_KEY (semantic-
  search embeddings), BALOO_API_KEYS (mobile v1 API service keys). Never call these from the client. The ONLY `NEXT_PUBLIC_*` vars are `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY` — public by design
  (Supabase safety is RLS, not key secrecy). No other secret ever gets a `NEXT_PUBLIC_` prefix.
- Model: claude-sonnet-4-6 (see lib/config.ts). Use the AI SDK: `generateObject` for extract,
  `streamObject` + `experimental_useObject` for the streamed analysis.
- Claude is the extraction layer — NO per-retailer CSS/regex parsers.
- Ingredient order = label order (most-to-least by quantity). Preserve it; never re-sort.
- Two caches: L1 Upstash Redis keyed by `hashUrl(url)` (7-day TTL, skips everything) + L2 the Postgres
  catalog keyed by identity (`canonical_key`, skips the analyse). ALL infra is OPTIONAL in code —
  Redis, Postgres, Supabase and email each degrade to a silent no-op when absent, and the app must
  boot with zero env vars.
- `ANALYSIS_MAX_TOKENS = 16000` (lib/config.ts) on BOTH analysis paths — the Anthropic default of
  4096 truncates long ingredient lists, the object never validates, and the `after()` persist is
  silently lost. Do not remove it.
- Every failure shows ONE friendly message, never a raw error:
  "We couldn't read that page. Try a direct product link from Whole Foods, Ocado, Tesco, Target,
  or Kroger."

## Data layer (Phase 2 — scan logging)
- On every SUCCESSFUL analysis, `lib/stats.ts` logs a scan to Upstash: a capped "recent scans" list
  plus "top retailers" and "top countries" sorted sets. Powers the homepage board (Order D) and,
  later, B2B trends (which graduate to Postgres).
- `recordScan` is fire-and-forget and MUST never slow or break the user flow; like the cache, it is
  a silent no-op when the Upstash env vars are absent.
- Privacy: NO PII. Product name, retailer, country-level (Vercel geolocation), and timestamp only —
  no user identity, no exact location, no dedup by user.
- Feature flag: `SHOW_TOP_SCANNERS` stays off until accounts exist.
- `/api/board` serves `getBoard()` + the `SHOW_TOP_SCANNERS` flag for the idle-homepage board,
  briefly cached (s-maxage 60); load-time fetch only, no polling.

## Data layer (Phase 3 — community platform, Orders G1–G9 + P1–P2)
- Postgres via Supabase + Drizzle: schema in `lib/db/schema.ts` (source of truth; migrations
  generated into `drizzle/`, `0000`–`0007`), lazy client in `lib/db/index.ts` — **null when
  DATABASE_URL is absent**, the app must keep running without it (same optional-infra rule as Redis).
- Two invariants: products dedupe on `canonical_key` (barcode, else normalised brand+name+size —
  everyone converges on ONE row per real product), and ingredient `what_it_is` is cached
  product-INDEPENDENTLY on `ingredients` while `why_its_here`/`role` live per-product on
  `ingredient_profile_items`.
- Ingredient profiles are versioned, never deleted (`is_active` flags the current one).
- Product/Offer split (P1): one product, many `offers` (retailer listings) → dedupe + "also available
  at". The analysis engine (P2, `lib/analysis/`) makes analysis a resumable background job; the
  identity short-circuit skips re-analysing a product we already know.
- RLS is defence-in-depth for client access paths (`drizzle/0001_rls.sql`); server-side Drizzle
  bypasses it — API routes enforce auth in code (G2 `requireUser`).
- Canonical plan: `Baloo_Phase3_Build_Orders.md` (spec) + `Baloo_Phase3_ProductOffer_Reconciliation.md`
  (current plan). Historical docs (full guide, old design handoffs, benchmark) live in `docs/archive/`.

## Nutrition rules (Phase 2 — B1–B4)
- Extraction (B1) captures the nutrition panel verbatim — values exactly as printed, never
  invented or converted; empty when a page has no panel.
- ALL arithmetic happens in code (`lib/nutrition.ts`, Order B3) — the model never calculates;
  it only writes short, neutral context sentences around numbers computed in code.
- NO health score, NO nutrient colour-coding (no red/green), NO good/bad verdicts. Bars and
  numbers are neutral (ink-tinted); context, not judgment.
- Nutrition context is general education, not advice: the disclaimer is always shown, and child
  framing stays neutral and non-restrictive ("General estimate from public UK reference values
  (FSA/NHS) — not personalised medical or dietary advice.").
- Profiles = UK reference daily intakes in `lib/profile.ts` (PHE "Government Dietary
  Recommendations" 2016 + NHS front-of-pack RIs; sources cited in the file). Presets only, no
  custom profiles in v1. Choice persists in localStorage — no accounts.
- Context line: `/api/nutrition-context` generates it once per product×profile (Upstash-cached,
  7 days). Percentages and highlight selection are computed in code (`lib/nutrition.ts`); Claude
  only phrases the given numbers, and a deterministic fallback sentence covers missing keys or
  model errors so the Nutrition tab never blocks.

## Ingredient list rules (Order F)
- The list is progressive: collapsed rows by default (rank, name, %, role microlabel, N/P pill),
  the full Order-A explanation unfolds on tap. Multi-open accordion; label order absolute.
- `role` is a neutral functional label and `product_summary` ONE neutral sentence — never
  judgments. The read strip's counts are computed in code, never by the model.
- Still no score, no "worth a look"-style flags, no judgment colours anywhere; the
  Natural/Processed pill stays the only meaningful colour.

## Tone for the analysis model (verbatim)
"You are a knowledgeable, calm nutritionist. Education before persuasion. Never alarmist. Never
tell the user what to buy or avoid. Explain what ingredients are and why they are used. Context
over judgment." (in lib/prompts.ts)

## Auth & security
- Auth provider is **Supabase Auth (GoTrue)** — a managed third party; we never store or hash
  passwords. `profiles.id` is a FK to `auth.users.id` and RLS uses `auth.uid()`, so auth MUST stay in
  our Postgres — do NOT propose migrating to Clerk/Auth0 (it splits auth from data and breaks RLS).
- Gates in `lib/auth.ts`: reads are public; `requireUser()` (401) = any signed-in incl. guest;
  `requireVerifiedUser()` (403 `verify_required`) = a REAL account (not anonymous) — the **guests
  analyse-only** wall (S2), on every community write (lists/comments/follows/votes/saves/reports);
  `requireAdmin()` (403) = moderation. Server Drizzle bypasses RLS, so these code checks are the real
  enforcement. Client controls use `useAuthGate()` to prompt sign-in/upgrade on 401/403.
- Rate limiting (S1, `lib/ratelimit.ts`) guards the paid routes (extract/analyze/nutrition-context by
  IP; explain/products-analyze by user). Optional-infra: no-op (fail-open) without Upstash — so it is
  INERT until `UPSTASH_REDIS_REST_URL/TOKEN` are set (empty locally; unset on Vercel).
- Security headers (S5, `next.config.mjs` `headers()`): HSTS, X-Frame-Options DENY, nosniff,
  Referrer-Policy, Permissions-Policy AND the CSP are all **ENFORCING**. The CSP's only cross-origin
  is Supabase (`connect-src` derives its https+wss origin from the public env var); everything else is
  same-origin / inline / data:/blob:. Enabling Sentry Session Replay later needs `worker-src 'self'
  blob:` added there (the DSN's connect-src origin is already derived).
- Still PLANNED (S-series, `Baloo_Launch_Plan.md`): captcha/Turnstile (deferred — needs Cloudflare +
  Supabase setup), write volume caps (S4), WAF (S5's headers + CSP are done), Sentry (S6), account
  deletion + unsubscribe (S7).

## Scope
- **Graduated IN (built):** accounts/login, saved lists + saves, the nutrition-panel context, the
  community platform (profiles, discovery, follows/feed, comments, moderation), **AI semantic search**
  (`lib/embeddings` + pgvector; optional-infra — keyword-only without OPENAI_API_KEY; see
  `docs/SEMANTIC_SEARCH.md`), **username rules** (`lib/handle`, `docs/USERNAME_RULES.md`), and the
  **mobile v1 API** (`/api/v1/*`, service-key auth via `lib/apiAuth`; `docs/API_CONTRACT_V1.md`). The
  active track is the beta launch (`Baloo_Launch_Plan.md`): V3 design port, seed supply, one-click
  social sharing, plus the S-series security hardening.
- **Still out of scope — do NOT build:** **scores/ratings/traffic-lights (forbidden forever)**,
  good/bad verdicts or "better-than" comparisons, a paywall (Stripe account only, no paid tiers in
  the beta), non-food products, and multiple languages/i18n. **Native mobile is deferred** (backlog
  M1) — web/PWA is the target for now, but keep `lib/` portable for the eventual app.

## Versions / gotchas
- Pinned to AI SDK v4 line (`ai` ^4, `@ai-sdk/*` ^1). If you upgrade to a newer major, the import
  paths / function names may shift (e.g. `experimental_useObject`, `toTextStreamResponse`) — migrate
  per the AI SDK docs.
- Firecrawl is called via REST (/v2/scrape) in lib/firecrawl.ts to avoid SDK version drift; verify
  the response shape if Firecrawl changes it.
- Next.js 15: route `params`/`searchParams` are async (`Promise<…>`) — await them.
- Postgres via postgres.js with `prepare: false` over Supabase's **transaction pooler** (a pooler
  requirement); after schema edits run `db:generate` → `db:migrate`, then re-run the Supabase security
  advisor after any DDL.
- Keep the pipeline in lib/ framework-agnostic so the mobile app can reuse it.
