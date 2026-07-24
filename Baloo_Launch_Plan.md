# Baloo — Launch Plan (beta)

**Context.** Jitain wants a **beta launched soon**, rough edges acceptable. This is the re-prioritised
"next days" track, synthesising his ASAP asks + the 16 July meeting + the community-strategy
discussion. It runs alongside the P-series data plan (`Baloo_Phase3_ProductOffer_Reconciliation.md`);
where they overlap, **this ordering wins for launch**. Working board: the `Baloo_Project_Hub` Notion page.

## Decisions locked this session (Jitain + strategy discussion)
- **Design direction: V3** (warm boutique — cream + Playfair Display). Resolves the V1/V2/V3 blocker.
  The port starts with Mobbin references + the app shell.
- **Save, not Like.** A list carries ONE social signal: **Save**. "Saved by N people" is the
  popularity + trust metric (a save = "I'll keep this", stronger than a casual heart). Products are
  **saved as favourites** too. No upvote/like. → this contradicts shipped code (see Open decisions).
- **Real numbers only.** Solve cold-start by seeding **supply** (great lists + official accounts),
  never by faking demand — 3 saves shows "3".
- **Search is the homepage.** One box, two intents: a URL → ingredient analysis; natural language
  ("kids cereals without junk") → **AI semantic search over PUBLIC lists**. People arrive with a
  *need*, not a person in mind — search solves cold-start better than browsing strangers. This is
  the #1 community feature.
- **Public profile = distribution.** `baloo.life/@username` is a shareable landing page (flyers,
  IG/TikTok bio, WhatsApp, Reddit). Every curator is an acquisition channel.
- **Usernames:** one unique handle, changeable (**90-day cooldown**); old handles **permanently
  redirect and are never reused**; reserve the new handle on change. (GitHub/X model, not aliases.)
- **Visibility (MVP = list-level only):** lists are public/private; a **profile is public
  automatically when it has ≥1 public list**, otherwise fully private/undiscoverable. No separate
  account-discoverability toggle in v1 — "publish a list → you join the community."
- **Positioning:** *"Helping each other eat better"* / *"Discover better food choices, together."* —
  "better" is deliberately subjective (fewer additives / more protein / cheaper / kids will eat it).

## The launch track (ordered)

### Tier A — beta-blocking (a credible beta needs these)
- **L1 — V3 design port** ✅ **COMPLETE.** Adopted V3 across the app, screen-by-screen.
  - **L1a ✅ shipped** — the V3 *world*: cream + Playfair tokens, flat covers, warm shadows, design
    canon updated. Whole app recoloured via the token layer at once (low per-screen risk); muted
    darkened to hold WCAG AA on cream. Blockers were already resolved, Mobbin refs logged.
  - **L1b ✅ shipped** — V3 homepage: hero (eyebrow + italic-green "your"), the `HomeSearch`
    dual-intent box (URL→analyse / text→/discover search, live intent chip), pill nav, and a
    saves-only "Popular lists this week" strip.
  - **L1c ✅ shipped** — V3 analysis view: the ingredient **count is the hero** (big Playfair green
    number + "ingredients in this product" + "In label order — N natural, N processed" subline,
    counts in code), plain Playfair `1,2,3` row numbers, and the tap-expand as V3's **two-beat**
    "What it is" / "In this product" labelled blocks. Canon gained a documented **Statement** type
    step (the Playfair-number exception to counts-in-Inter). `role` microlabel kept (Jitain to
    confirm vs V3 dropping it). — **CC**
  - **L1d-1 ✅ shipped** — the full-width sticky/blur app shell: `SiteHeader`'s `left` variant is now a
    `sticky top-0 z-40 w-full bg-canvas/75 backdrop-blur-md` bar lifted out of `<main>` (per-page inner
    width `tool`/`wide`), with a new `HeaderNav` client island marking the active section (active=ink).
    `AdminNavLink` folded in; welcome stays non-shell. Verified across home/discover/product/lists/feed. — **CC**
  - **L1d-2 ✅ shipped** — the header **search overlay**: a `HeaderSearch` trigger in the bar (hidden on
    `/`, `/`-key opens) → dual-intent modal (URL → `/?url=` home auto-run + param strip, text →
    `/discover?q=`); `looksLikeUrl` shared via `lib/retailers.ts`; nav collapses on mobile. — **CC**
  - **L1e ✅ shipped** — Lists V3 pass: list-detail editorial rows (plain Playfair `1,2,3`), own-list
    cleanup (no "by @you"/Save on your own list), empty-state leads with *Add product* (owner) / calm
    line (others), warmer `/lists` guidance states. — **CC**
  - **L1f ✅ shipped** — Discover V3 pass: shared `ProductRow` (thumbnail + Playfair name + meta + SVG
    chevron) across "Recently analysed" + search product results; search list rows swapped `→` → the
    same chevron. Consistency + DRY, no behaviour change. — **CC**
  - **L1g ✅ shipped** — Profile V3 pass: editorial empty-state cards on both tabs (Lists → *New list*
    CTA; Saved → owner variant + *Browse lists*, visitor variant), plus a copy fix — the Lists-empty
    state addressed the owner in the third person though L5c means only they ever see it. — **CC**
  - **L1h ✅ shipped** — Modals V3 pass: a shared `Modal` shell (backdrop + panel + Escape + robust
    `onMouseDown` backdrop-close + `role="dialog"`/`aria-modal`/labelling) adopted by AuthModal, the
    header SearchOverlay and ReportDialog — the last had **no Escape** and a click-close that fired on
    press-inside/release-outside. — **CC**
  - ✅ **L1 is COMPLETE** — the V3 design port has landed across the whole app (world → home → analysis
    → shell + search → lists → discover → profile → modals).
- **L4 — Seed supply.** *(~ tooling shipped, content blocked.)* `scripts/seed-supply.ts`
  (`npm run db:seed-supply`, **dry-run by default**) creates the official accounts
  (**@baloo, @balooteam, @proteinpicks, @kidslunchbox**) and the curated lists, analysing every
  product through the **real pipeline** so seeded lists carry genuine label-derived breakdowns. It
  never writes a save/follow/vote (**real numbers only**), never handles passwords (accounts are made
  password-less; set them in Supabase), validates retailers before spending, and analyses a list's
  products *before* creating it so a failure leaves nothing half-built. **Three things block the
  actual seeding — all need M/J:**
  1. **Editorial picks** — the four list themes are locked but the product URLs are empty. Someone has
     to choose real products (from a supported retailer) per list.
  2. **Spend authorisation** — each product costs 1 Firecrawl scrape + 2 Claude calls. ~5 products ×
     4 lists ≈ 20 analyses. The dry run prints the estimate.
  3. **"Mercadona essentials" can't be built** — Mercadona is not in `SUPPORTED_RETAILERS`
     (Whole Foods · Ocado · Tesco · Target · Kroger), so its URLs are rejected by validation *and* by
     `/api/extract`. Needs mercadona.es added to the retailer set first (Tier C, "more scrape sites").
  Also decide: seed against **dev or production** Supabase. — **CC done / M+J owed**
- **L5c — Visibility auto-public.** ✅ **shipped.** A profile is public only once it has ≥1 public list;
  `/u/[handle]` 404s for non-owners of a 0-public-list profile (generic metadata, no name/bio leak),
  the owner sees their own with a "publish a list to go public" nudge, and Share is hidden until then.
  Discovery surfaces already enforced it (search returns no profiles; suggested-curators inner-joins
  public lists). No migration. — **CC**
- **L2 — Social sharing (= P8, pulled forward).** ✅ **shipped.** `ShareSheet` (on the L1h `Modal`
  shell) replaces the bare Share button: card preview + **WhatsApp · Telegram · X · Facebook** intent
  URLs (`lib/share.ts`) + Copy link + Save image + a native **Share…** that shares the card as a
  `File` via `navigator.share({files})` when `canShare` allows — the path that puts Instagram in the
  mobile OS sheet. Reuses the existing `/api/og/list/[slug]` card; surfaces without a card (profiles)
  degrade to link-only. **Follow-ups:** portrait/IG-optimised card · profile + product cards ·
  product-page mount. True one-tap IG Stories remains native-only (M1). — **CC**

### Tier A — security (added 17 July, from Jitain's questions + a code audit)
**Auth is settled: we already use a third-party provider — Supabase Auth** (GoTrue), the same
category as Clerk. We never store or see passwords. Jitain's instinct that Clerk is B2B-shaped is
right, but the answer isn't another third party: our `profiles.id` is a FK to `auth.users.id` and
every RLS policy uses `auth.uid()`, which only works while auth lives in our own Postgres. Clerk/Auth0
would split them → sync webhooks + broken RLS + more cost, for no user-visible gain. **Harden, don't
migrate.** (Add Apple sign-in later — a checkbox.)

Three holes the audit found in shipped code:
- **Anonymous sign-in = free bot users.** `signInAnonymously()` is on and no write route checks
  `is_anonymous`: one HTTP call per user, no email, no captcha → unlimited users and lists.
- **`/api/analyze` + `/api/extract` are unauthenticated and unlimited**, and each call costs
  Firecrawl + Claude money. A for-loop is a financial DoS.
- **No custom SMTP.** Supabase's built-in mailer is dev-only and rate-limited — confirmation emails
  would silently stop arriving at launch.

- **S1 — rate-limit the expensive routes** ✅ shipped `9eaf514` (fail-open; inert until the Upstash
  REST vars are set on Vercel — the one remaining ops step for S1).
- **S2 — guest-publish wall** ✅ shipped (code): `requireVerifiedUser()` on every community write;
  guests analyse-only; `useAuthGate()` on the client. **Captcha deferred** (Turnstile — needs your
  Cloudflare + Supabase setup). Note: anonymous sign-in is currently disabled on the Supabase project.
- **S3 — custom SMTP** (Resend) + SPF/DKIM/DMARC. *Signup breaks at launch without it.*
  *(~ code fix + runbook shipped; the setup is M's.)* Full step-by-step in
  [`docs/EMAIL_SETUP.md`](docs/EMAIL_SETUP.md) — Resend on a sending subdomain, the three DNS records
  (DMARC starting at `p=none`), the exact Supabase SMTP fields, URL configuration, the auth
  rate-limit, and end-to-end verification. **Code fix already in:** `AuthModal` had no
  `emailRedirectTo`, so confirmation links fell back to the Site URL — i.e. a production signup could
  mail someone a **localhost** link. Both signup and the guest→account upgrade now pin
  `${origin}/auth/callback`; this needs the matching **Redirect URLs** allowlist entries to work.
  **Password-reset UI (was "also found"): ✅ shipped (S7c).** `AuthModal` "Forgot password?" → reset
  mode + a `/auth/reset` page; the callback now honours a same-origin `next`. The email itself only
  works once the SMTP setup above is done. — **CC done / M owed**
- **S4 ✅ write rate limits/caps shipped** (per-user limits on every community write + a 250-item
  hard cap; fail-open, inert until M's Upstash vars land — same as S1) · **S5** ✅ security headers shipped (enforcing safe set + report-only
  CSP); remaining: M flips leaked-password + Vercel WAF toggles, later flip CSP to enforcing · **S6**
  error monitoring (Sentry) · **S7a ✅ account deletion shipped** (GDPR erasure): migration `0008` made
  `lists.owner_id` + `comments.user_id` nullable/`SET NULL` — **every FK used to cascade**, so a
  deletion would have destroyed the person's public lists *and* other people's replies. Policy: erase
  the person, keep the community. `DELETE /api/account` + `/settings` typed-handle confirm; 13/13 E2E
  checks, advisor clean. **S7b unsubscribe still open** (blocked on N2/S3) · **S8** privacy policy +
  terms (**J**).

### Tier B — high-value fast-follow (can ship days after beta)
- **N1/N2 — Notifications.** In-app first (a bell over the existing `activity` table from G6), then
  **digest-batched** email once S3 lands — per-event email trains people to mute us, and a calm brand
  shouldn't blast. Default digest-only; prefs + one-click unsubscribe (S7).
- **L3 — AI semantic search over public lists.** The search-as-homepage bet; the single biggest
  community lever. Approach decided at plan time (pgvector embeddings on Supabase vs LLM-rerank over
  pg_trgm candidates). Semantic, not keyword — "cereals my 5-year-old can eat" must match
  "low-sugar kids cereals".
- **L6 — Save-only reconciliation.** ✅ **Upvote removal shipped**: votes API narrowed to comments
  (product/list → 400), mounts gone from the list + product pages, Popular ranks by saves alone, the
  feed drops "upvoted" stories; comment upvotes stay (Top sort). Non-destructive (historical rows
  kept). **Remainder open:** scanned-product organisation — save product as favourite,
  add-to-multiple-lists, keep-for-later (needs schema; rides with P3/the port).
- **L5a/b — Identity for distribution.** `baloo.life/@username` URL (profile at `/@handle`, redirect
  the current `/u/[handle]`); username change + permanent redirect.
- **L7 — Region prioritisation** ✅ **shipped.** Discover's "Recently added" grid soft-ranks by "% of a
  list's products purchasable in the viewer's region" (never a hard filter). Retailer→region map in
  `lib/config.ts`/`retailers.ts`, math in `lib/region.ts`, `getListsRetailers`/`withRegionAvailability`,
  an SSR "Shopping in US/UK" toggle (default Vercel geo), a neutral `ListCard` availability line. No
  migration — derived from `products`/`offers.retailer`. (Region reordering surfaces once lists hold
  retailer'd products; real scans set the retailer.) — **CC**

### Tier C — after beta
P3 two-mode add + unresolved items · P4 "also available at" · P6 OFF enrichment · more scrape sites
(gradually) · M1 native IG Stories · discovery feed de-emphasis.

## V3 design review (21 July) — ✅ resolved; the port (L1) is unblocked
V3 is past wireframe (real cream + Playfair) and lands Jitain's notes (ingredient view back to the
count + numbered rows + tap-to-expand two-box, empty-state **Add product**, centred new-list dialog,
own-list header cleanup, flat covers, region switch). The three blockers are now resolved in Claude
Design's updated files:
- **DEC-1 · Upvote → Save-only** ✅ — the updated V3 drops upvote entirely (state is `saves`). Code
  side is **L6** (remove the shipped Upvote; Popular = saves).
- **DEC-2 · Auth flow** ✅ — the V3 modal now shows **email+password + Continue with Google + Continue
  without an account**, matching the shipped methods (no magic-link, no S3 dependency).
- **FIX-1 · Share-card gradients** ✅ — removed; flat V3 tints applied.
- Still open (non-blocking, for the port): list-image direction (upload / auto-generate / shrink —
  Jitain leans shrink); the board's real-imagery treatment; the 2nd "create a list with THIS product" CTA.

## Open decisions still owed (recorded for Jitain)
- **Upvote vs Save.** Shipped code (G7) has BOTH an Upvote and a Save. "Save-only" implies
  **removing the Upvote entirely** and ranking Popular by saves. *Recommend: yes — Save-only
  everywhere, products are "favourited" (= saved).* Confirm before L6.
- **Comments / feed / moderation at launch?** Built (G8/G6/G9) but beyond the stated community
  priority ranking. *Recommend: keep comments + moderation ON (safety net); keep the feed but
  de-emphasise it — search is the front door.* Confirm.
- **Semantic-search infra:** pgvector vs LLM-rerank — decide at L3 plan time.
- **URL cutover to `/@username`:** do it in L5, or defer with P7's nav reconciliation.

## Checkpoints from the 16 July meeting (answered / to define in L1)
- **Homepage vs user page:** homepage = the dual-intent search + discovery; user page =
  `baloo.life/@handle`, a curator's profile/landing. Nail the distinction in L1's design.
- **Where search sits:** it IS the homepage (see decisions).
- Flyer strategy note: the profile URL doesn't change legal responsibility for posting flyers —
  use permitted spots (noticeboards, cafés, campuses). (Product-strategy takeaway kept; legal detail
  is Jitain's to own.)
