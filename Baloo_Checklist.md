# Baloo — Master Checklist

> Living list of what's **pending** across every phase. Markdown checkboxes paste straight into
> Notion as to-do blocks. Update as orders land; the detailed reasoning lives in
> `Baloo_Phase3_ProductOffer_Reconciliation.md` (the plan) and `Baloo_Phase3_Build_Orders.md` (the spec).
>
> **Owners:** **M** = Miquel · **J** = Jitain · **CC** = Claude Code · **CD** = Claude Design
> **Last updated:** after `58ad98a` (org pass) — **launch pivot: see `Baloo_Launch_Plan.md`**

## 🚀 Launch track (beta) — the new top priority
> Jitain wants a beta out **soon**. Full ordering + locked decisions in `Baloo_Launch_Plan.md`.
> ✅ **Design direction chosen: V3** (warm boutique) — the old blocker is resolved.

**Tier A — beta-blocking:**
- [x] **L1 — V3 design port** ✅ **COMPLETE** (L1a world · L1b home · L1c analysis · L1d shell+search ·
      L1e lists · L1f discover · L1g profile · L1h modals) — **CC/CD/M**
  - [x] **L1a — the V3 world** ✅ shipped: cream + Playfair tokens (tailwind + layout), flat cover
        tints, warm shadows, OG route, design canon (DESIGN.md + design.json). muted darkened to AA
        (`#766753`, 4.71:1). Whole app recoloured at once; verified live. — **CC**
  - [x] **L1b — homepage** ✅ shipped: V3 hero (eyebrow, italic-green "your"), `HomeSearch` dual-intent
        box (URL→analyse / text→/discover, live intent chip), nav → pills, `PopularLists` strip
        (`/api/popular`, saves-only). Verified live. *(full-width sticky shell → L1d; count view → L1c)* — **CC**
  - [x] **L1c — analysis view** ✅ shipped: hero ingredient count (big Playfair green number + subline,
        counts in code), plain Playfair `1,2,3` rows, two-beat "What it is / In this product" expand;
        canon gained a **Statement** type step. `role` kept (Jitain to confirm). Verified live on `/p`.
        (drawer variant rides with P5) — **CC** *(Mobbin: Julienne)*
  - [x] **L1d-1 — app shell** ✅ shipped: `SiteHeader` `left` variant → full-width sticky blur bar
        (`sticky top-0 z-40 w-full bg-canvas/75 backdrop-blur-md`), lifted out of `<main>`; per-page
        inner width (`tool`/`wide`); new `HeaderNav` client island marks the active section
        (`usePathname`, active=ink); `AdminNavLink` folded in. Welcome stays non-shell. Verified across
        home/discover/product/lists/feed. — **CC**
  - [x] **L1d-2 — header search overlay** ✅ shipped: `HeaderSearch` trigger in the bar (hidden on `/`,
        `/`-key opens) → dual-intent modal (URL → `/?url=` home auto-run + param strip, text →
        `/discover?q=`); `looksLikeUrl` shared via `lib/retailers.ts`; nav collapses on mobile. Verified
        live (text route, URL handoff, trigger show/hide). — **CC**
  - [~] Per-screen passes — **CC**
    - [x] **L1e — lists** ✅ shipped: list-detail editorial rows (plain Playfair `1,2,3`), own-list
          cleanup (no "by @you"/Save on your own list), empty-state leads with *Add product* (owner) /
          calm line (others), warmer `/lists` guidance states, `ListCover` comment fixed. Verified.
    - [x] **L1f — discover** ✅ shipped: shared `ProductRow` (thumbnail + Playfair name + meta + SVG
          chevron) across "Recently analysed" + search product results; search list rows swapped `→`
          → the same chevron (one row affordance app-wide). Verified.
    - [x] **L1g — profile** ✅ shipped: editorial empty-state cards on both tabs (Lists → *New list*
          CTA; Saved → owner variant + *Browse lists*, visitor variant), and fixed the Lists-empty
          copy bug (spoke about the owner in the third person, but L5c means only they see it).
          `FollowButton` already self-hides on own profile. Visitor path verified live.
    - [x] **L1h — modals** ✅ shipped: shared `Modal` shell (backdrop + panel + Escape + robust
          backdrop-close + `role="dialog"`/`aria-modal`/labelling) adopted by AuthModal, the header
          SearchOverlay and ReportDialog — the last had no Escape and a fragile click-close. Verified.
- [~] **L4 — Seed supply**: official accounts (@baloo/@balooteam/@proteinpicks/@kidslunchbox) + genuinely good starter lists — **M/J/CC**
  - [x] **Tooling** ✅ `scripts/seed-supply.ts` (`npm run db:seed-supply`, dry-run by default): creates the
        accounts + lists, analyses each product through the real pipeline, never writes saves/follows
        (real numbers only), never handles passwords, validates retailers before spending. — **CC**
  - [ ] **Editorial picks**: real product URLs (supported retailer) for each of the 4 lists — **J/M**
  - [ ] **Authorise the spend**: ~20 products × (1 Firecrawl + 2 Claude calls) — **M**
  - [ ] **Decide target**: seed dev or production Supabase — **M**
  - [ ] **"Mercadona essentials" blocked**: Mercadona isn't in `SUPPORTED_RETAILERS` — needs
        mercadona.es added first (Tier C, more scrape sites) — **J/M**
- [x] **L5c — Visibility auto-public** ✅ shipped: `/u/[handle]` 404s for non-owners of a 0-public-list
      profile + generic metadata; owner sees own + a "publish to go public" nudge (Share hidden).
      Discovery surfaces already compliant. Verified (non-owner 404 / owner nudge / public unaffected). — **CC**
- [x] **L2 — Social sharing** (= P8, pulled forward) ✅ shipped: `ShareSheet` on the L1h `Modal` shell —
      card preview + WhatsApp/Telegram/X/Facebook intents (`lib/share.ts`) + Copy link + Save image +
      native `Share…` sharing the card as a `File` (puts Instagram in the mobile OS sheet). Reuses the
      existing OG card; profiles degrade to link-only. Verified live. — **CC**
  - [ ] Follow-ups: portrait/IG-optimised card · profile + product cards · product-page mount — **CC**

**Tier A — security (17 July audit; a beta with real users needs these):**
> Auth verdict: **we already use a third-party provider — Supabase Auth.** Not rolling our own; no
> migration to Clerk/Auth0 (it would split auth from our Postgres and break `auth.uid()` RLS). The
> work is hardening, not migrating. Full reasoning in the Notion hub.
- [x] **S1 — Rate-limit the expensive routes** ✅ shipped `9eaf514` (`lib/ratelimit.ts`; extract/
      analyze/nutrition-context by IP, explain/products-analyze by user; friendly 429). ⚠️ **INERT
      until the Upstash REST vars are set** — empty locally, unset on Vercel (see Ops). — **CC done / M owes env**
- [x] **S2 (code) — Guest-publish wall** ✅ shipped: `requireVerifiedUser()` on every community write
      (lists/comments/follows/votes/saves/reports/products-analyze); guests analyse-only; client
      `useAuthGate()` prompts sign-in/upgrade. Verified: 401 signed-out (7 routes) + real account
      passes. *(Note: anonymous sign-in is currently DISABLED on the Supabase project, so the guest
      vector isn't live there today — the code guards it regardless.)*
- [ ] **S2 (captcha) — DEFERRED**: Cloudflare Turnstile on signup + anonymous (Supabase-native).
      Needs a Cloudflare account + the secret in the Supabase dashboard + `NEXT_PUBLIC_TURNSTILE_SITE_KEY`;
      then wire the widget into the auth modal. — **M sets up infra / CC wires**
- [~] **S3 — Custom SMTP** (Resend; Loops stays marketing) + SPF/DKIM/DMARC on baloo.life.
  - [x] **Code fix** ✅ `emailRedirectTo` on signup + guest→account upgrade — confirmation links used
        to fall back to the Site URL (a prod signup could mail a **localhost** link). — **CC**
  - [x] **Runbook** ✅ [`docs/EMAIL_SETUP.md`](docs/EMAIL_SETUP.md) — Resend, DNS, Supabase SMTP fields,
        URL config, rate limit, verification. — **CC**
  - [ ] Resend account + `baloo.life` sending subdomain verified — **M**
  - [ ] SPF + DKIM (from Resend) + DMARC (`p=none` first) DNS records — **M**
  - [ ] Supabase custom SMTP fields + raise the auth email rate limit — **M**
  - [ ] Supabase **Site URL** + **Redirect URLs** allowlist (prod, `*.vercel.app`, localhost) — **M**
  - [ ] End-to-end test: real inbox + Gmail, SPF/DKIM/DMARC all PASS, link lands signed in — **M**
  - [x] **S7c — Password-reset UI** ✅ shipped (found during S3): `AuthModal` "Forgot password?" →
        reset mode + `/auth/reset` page; callback honours a same-origin `next`. Verified live (states
        + invalid-session guard). Email path testable once SMTP (S3) is live. — **CC**
      Supabase's built-in mailer is dev-only + rate-limited → **confirmation emails silently stop
      arriving at launch**. — **M/CC**
- [x] **S4 — Write rate limits + volume caps** ✅ shipped: per-user limits on every community write
      (writeList 30/day · listItem 120/min · comment 8/min · follow 30/min · save 40/min · vote 60/min ·
      report 8/5-min) via the S1 limiter, + a hard `MAX_ITEMS_PER_LIST=250` (always-on count, 409
      `list_full`). Fail-open + **inert until the Upstash vars are set** (same as S1). Verified
      fail-open + count; 429 needs Upstash. — **CC** *(depends on M's Upstash env vars)*
- [x] **S5 (headers) — Security headers** ✅ shipped (`next.config.mjs`): HSTS · X-Frame-Options DENY
      · nosniff · Referrer-Policy · Permissions-Policy (enforcing) + **report-only CSP** (Supabase
      origin in `connect-src`). Verified: present + zero CSP violations + sign-in works. — **CC done**
  - [ ] **M toggles:** enable **leaked-password protection** (Supabase → Auth → Passwords; clears the
        advisor WARN) + **Vercel WAF / Attack Challenge Mode** (Vercel → Firewall) — **M**
  - [ ] *(later)* flip CSP to **enforcing** once report-only is clean in prod (pairs with S6's report
        endpoint) — **CC**
  - [ ] *(dropped from S5)* "zod on every body" — free-text routes already cap server-side; fold any
        standardization into S4 — **CC**
- [~] **S6 — Error monitoring** (Sentry) — "stable from the get-go" = knowing prod broke first
  - [x] **Wiring** ✅ `@sentry/nextjs` guarded across server/edge/client; inert without a DSN; CSP
        `connect-src` derives the ingest origin. Verified build green with no DSN. — **CC**
  - [ ] Create a Sentry project + set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` on Vercel — **M**
  - [ ] *(later)* source-map upload for readable stack traces (needs a `SENTRY_AUTH_TOKEN`) — **CC/M**
- [~] **S7 — "Dar de baja"** — **CC**
  - [x] **S7a — Account deletion** ✅ shipped (right to erasure). Migration `0008` flips
        `lists.owner_id` + `comments.user_id` to nullable/`SET NULL` — previously **every** FK cascaded,
        so deleting an account would have hard-deleted the person's public lists *and* other people's
        replies. Policy: **erase the person, keep the community**. `DELETE /api/account`
        (`requireUser`, id from the session) + `/settings` → typed-handle confirm dialog. Verified by
        `scripts/check-account-deletion.ts` (13/13) + clean security advisor.
  - [ ] **S7b — Email unsubscribe** (GDPR + Gmail/Yahoo one-click header). Blocked: no notification
        emails exist yet (N2, which needs S3); Loops carries its own unsubscribe for marketing. — **CC**
- [ ] **S8 — Privacy policy + terms** on baloo.life *(no cookie banner needed while analytics-free)* — **J**

**Tier B — fast-follow (days after beta):**
- [ ] **N1 — In-app notifications** — a bell + unread count over the existing `activity` table (G6) — **CC**
- [ ] **N2 — Email notifications** *(needs S3)* — same events, **digest-batched**, prefs + opt-out;
      default digest-only, never per-event blasting — **CC**
- [ ] **L3 — AI semantic search over public lists** (search-as-homepage; pgvector vs LLM-rerank TBD) — **CC**
- [x] **L6 (upvote removal) — Save-only** ✅ shipped: votes API = comments only (product/list → 400),
      UpvotePill mounts gone from list + product pages, Popular = saves alone, feed drops "upvoted"
      stories. Comment upvotes kept (Top sort). Non-destructive, no migration. Verified E2E. — **CC**
- [ ] **L6 (remainder) — scanned-product organisation**: save product as favourite ·
      add-to-multiple-lists · keep-for-later. Needs schema (saves are list-scoped today); rides with
      P3 / the V3 port. — **CC**
- [ ] **L5a/b — Identity**: `baloo.life/@username` URL + username change with permanent redirect — **CC**
- [x] **L7 — Region prioritisation** ✅ shipped: retailer→region map (`lib/config.ts`/`retailers.ts`),
      availability math (`lib/region.ts`), `getListsRetailers` + `withRegionAvailability`, the "Shopping
      in US/UK" toggle (SSR, default geo), and a neutral `ListCard` availability line. No migration;
      soft-rank only. Verified (math + live query). *Note: current seed lists hold two retailer-less
      products, so region reordering shows only once lists contain retailer'd products (real scans do).* — **CC**

**V3 design review — ✅ resolved 21 Jul; the port (L1) is unblocked** *(detail in `Baloo_Launch_Plan.md`)*:
- [x] **DEC-1** Upvote → Save-only — reflected in the updated V3 (upvote gone, `saves` used). Code side = L6.
- [x] **DEC-2** Auth flow — updated V3 modal now shows email+password + Google + guest, matching shipped code.
- [x] **FIX-1** Share cards — gradients removed, flat V3 tints applied. — **CD done**
- [ ] Still open (non-blocking): list-image direction (upload/auto-gen/shrink) · board real imagery · 2nd "create list with THIS product" CTA

**Decisions still owed from Jitain** (in `Baloo_Launch_Plan.md`): Upvote→Save removal (DEC-1) · auth flow (DEC-2) · comments/feed/moderation
at launch · semantic-search infra · `/@username` URL cutover timing · keep guest mode (rec: yes, but
guests can't publish) · email default (rec: digest-only) · deleted accounts — keep public lists with the
curator anonymised (rec) or delete · who owns privacy policy + terms.

## Phase 3 — Product/Offer (P-series)  *(Tier C / interleaves after beta)*

**Shipped:** ✅ **P1** (offers table, `analysis_status`, pg_trgm) · ✅ **P2** (pipeline lib, background
analyse engine, identity short-circuit, offers RLS, and the `maxTokens` prod-bug fix)

- [ ] **P3 — Two-mode add-product** *(next up; the P2 engine is ready to call)* — **CC**
  - [ ] Catalogue search in the list-builder: **own products first**, recents shown before typing
  - [ ] Detect a pasted URL → **"Analyse & add"** → background via `runAnalysisForProduct()` in `after()`
  - [ ] Migration: `list_items` allows **unresolved items** (nullable `product_id` + `free_text` + resolved flag)
  - [ ] "Unresolved — no analysis" row state + a visible "add link" affordance
  - [ ] Status surfacing: `pending → analysing → done | failed` (Supabase Realtime, fallback poll) + retry
- [ ] **P4 — "Also available at A, B, C"** *(pure frontend — `getOffersForProduct` already exists)* — **CC**
  - [ ] Product page + list rows: "scanned from X · also at A, B, C"
- [ ] **P5 — Quick-view** *(needs the design pick)* — **CC**
  - [ ] One `<IngredientAnalysis productId>` in two containers: full page + drawer (desktop) / sheet (mobile)
  - [ ] Close returns to the exact scroll position; loading / analysing / failed states
- [ ] **P6 — Open Food Facts enrichment layer** *(gated on J's legal posture)* — **CC**
  - [ ] `off_*` namespace, **physically separate** from the proprietary tables
  - [ ] Barcode → on-demand lookup, cache what we touch, **no bulk mirror**
  - [ ] ODbL attribution surfaced
- [ ] **P7 — Nav + scope reconciliation** *(needs the design pick)* — **CC**
  - [ ] Align main nav → **Discover · My Lists · @username**
  - [ ] Decide exposure of the already-built Feed / Comments / Moderation (recommend: keep, de-emphasise) — **J**
  - [ ] Update `CLAUDE.md` to the reconciled rules
- [ ] **P8 — One-click social share** *(self-contained; pull early if distribution matters)* — **CC**
  - [ ] Mobile: `navigator.share({ files: [OG card] })` → OS sheet **with Instagram in it** (~2 taps)
  - [ ] Desktop: intent URLs — WhatsApp · Telegram · X · Facebook + Copy link + Save image
  - [ ] Mount on the list page → then product + profile
  - [ ] ⚠️ **Never promise one-tap Instagram Stories on web** — impossible from a browser (see M1)

## Design (CD + the PART C ritual)
- [ ] Send **B2** — seamless create-a-list — **M→CD**
- [ ] Send **B3** — list detail (view-analysis icon, also-available-at, unresolved item) — **M→CD**
- [ ] Send **B4** — two-mode search (recents / catalogue / paste / "Analysing…") — **M→CD**
- [ ] Send **B5** — analysis in two containers + the quick-view drawer/sheet — **M→CD**
- [ ] Port the chosen direction **per screen**: three approaches → critique ritual → build — **CC**
- [ ] Collect Mobbin references + align with J before building — **M/J**
- [ ] *(Optional)* D-G9 restyle of the moderation surfaces — **CD**

## Ops / pre-launch
- [ ] **Enable Auth leaked-password protection** in the Supabase dashboard *(advisor WARN)* — **M**
- [ ] *(Low priority)* Move `pg_trgm` out of the `public` schema *(advisor WARN)* — **M**
- [ ] Verify **Vercel prod env vars**: `DATABASE_URL`, Supabase keys, `ANTHROPIC_API_KEY`, `FIRECRAWL_API_KEY` — **M**
- [ ] **Upstash REST vars** (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`) — the Vercel Redis
      integration exposed `REDIS_URL`, which our code doesn't read. The homepage board and the caches
      stay empty until this is fixed. *Small fix, visible payoff.* — **M**
- [ ] Run `npx tsx scripts/make-admin.ts <jitain-handle>` once he has an account — **M**
- [ ] Decide: promote `/feed` to the **signed-in homepage**? (one-line change) — **J**
- [ ] Decide: commit or gitignore the untracked `.agents/`, `.claude/skills/`, `skills-lock.json`,
      `Baloo_FigmaMake_Brief.md` — **M**

## Decisions needed from Jitain
- [ ] Confirm **analysis stays normalised** (shared `what_it_is` cache) rather than a JSONB blob — *recommended; he can veto*
- [ ] Confirm the **OFF stance**: on-demand + walled-off now; **legal advice before any B2B/paid use**
- [ ] Confirm **no pricing in v1**, with the plumbing ready for a future affiliate layer (visible disclosure)
- [ ] **Legal review of the OFF (ODbL) licence** before OFF data touches anything sold — **J**

## Backlog (recorded, not scheduled)
- [ ] **M1 — True one-tap "Share list to Instagram Stories"** → **mobile app only** (Meta Sharing-to-Stories
      SDK + a registered Facebook App ID). Groundwork already done: the OG card image exists at
      `/api/og/list/[slug]`. *The strongest concrete argument for building the app.*
- [ ] **H1 — Bulk catalogue seed** (makes discovery feel full on day one)
- [ ] Discovery-list → **shopping-list conversion** *(the recurring gap across the benchmark)*
- [ ] Availability / locality signals (`offers.available`)
- [ ] Category taxonomy + `/c/[category]` landing pages (`products.category` column is ready)
- [ ] OFF-for-B2B (post-legal)
- [ ] Affiliate layer (behind visible disclosure)
- [ ] Price snapshots (`offers.price` / `currency` / `price_at` exist, deliberately NULL in v1)

## Known-good state (context, not tasks)
- Catalog: 4 products, **all canonical** — a real scan now resolves by identity instead of duplicating.
- Demo data kept on purpose: `@baloo-dev` (admin), `@baloo-friend`, "Dev: first board", "Friend's cupboard",
  and the Oatly discussion thread.
- Phases 1–2 and Orders G1–G9 are complete and verified.
