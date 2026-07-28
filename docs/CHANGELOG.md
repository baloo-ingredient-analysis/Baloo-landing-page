# Baloo — Changelog

> Human-readable record of what **shipped**, newest first. Append an entry when a milestone lands
> (a phase, an order, or a notable fix) — one bullet per meaningful change, with the commit. This is
> the curated story; `git log` is the full record. Deeper "how it works" lives in
> [`ARCHITECTURE.md`](ARCHITECTURE.md); what's *planned* lives in `Baloo_Launch_Plan.md`.

## Unreleased / in progress

### `profile-page` branch (Orders PP1–PP4) — Pinterest-style profile + product Pantry
> Not on `main` yet — this whole block ships when the branch merges.
- **PP1 — Product Pantry (save products):** products can now be **Saved** to a private **Pantry** (a
  collection of saved products), distinct from saving whole lists. New `product_saves` table
  (`userId`,`productId`, PK) + migration 0009 with **owner-only RLS** (private, unlike public `saves`).
  `lib/db/queries/pantry.ts` + `POST/DELETE /api/pantry` (`pantry` rate limit). New `PantryButton`
  (neutral-ink bookmark) sits on the product page **beside** "Add to my list" — both actions coexist.
- **PP2 — Profile = Pantry + Lists tabs (Pinterest-style):** `/u/[handle]` now has a **Pantry** tab
  (owner-only, private; a product grid with instant name-search) and a **Lists** tab that **unifies**
  your created lists *and* lists you saved from others, with a **Latest / Most-popular** sort. Visitors
  see only public created lists, no Pantry. `/lists` redirects signed-in users to their profile Lists tab.
- **PP3 — Create a list from the Pantry:** a "Create list" button opens a modal (name + public/private
  toggle), then the Pantry drops into a **selection mode** to tick which saved products go in ("Add N to
  list"). Reuses `createList` + `addListItem` — no new schema.
- **PP4 — Nav line-icons:** the header nav (Following / Discover / Lists / Admin) is now curated
  line-icons with the word revealed on hover/focus (always-present `aria-label`); **Lists** points at the
  owner's profile Lists tab.

- **L9 — Discover becomes Explore:** Discover is now the **Explore** surface — one ranked grid of
  public lists from people you *don't* follow (your Following lists already live at `/feed`), plus the
  "Recently analysed" product rows. The old three-section layout (Popular / Recently added / Recently
  analysed) is gone. New `getExploreLists` blends the public + internal engagement signals
  (`likeCount + saveCount`) with a recency decay, then the L7 region soft-rank re-orders by "what you
  can actually buy" — and when you're signed in it **excludes your own lists and everyone you follow**
  (reusing `getFollowingIds`), so Explore is genuinely *new* people. Search/category relevance is still
  deferred (no taxonomy yet — the SearchBox stays the finder). Verified in-browser against the dev DB:
  Explore renders ranked, the region toggle re-ranks, console clean.
- **L8 — Lists gain a public Like (Save goes private); product CTA "Add to my list":** reverses the
  L6 "Save is the one signal" decision for **lists**. A list now carries **two** signals — a **Like**
  (public, count shown, feeds Popular/Explore ranking) and a **Save** (private, into your library,
  count never shown publicly, an internal ranking signal only); you can both like and save the same
  list. **No migration** — likes reuse the already-polymorphic `votes` table (`target_type = 'list'`),
  so L8 just re-widens the two boundaries L6 narrowed (the `VOTABLE` whitelist and a hard-typed pill).
  New `LikePill` (a coloured **rose-red heart**, the one social accent — reserved off all
  ingredient/nutrition UI, see the DESIGN.md colour-rule reframe), mounted beside `SavePill` on the
  list page; `ListCard` now shows "N liked" and never a public save count; `/api/search` exposes
  `likeCount`, not the private `saveCount`; "Popular this week" ranks by likes. **Products** get no
  like/save — their one action is the renamed **"Add to my list"** CTA (`AddToList`, otherwise
  unchanged). Verified end-to-end in-browser: signed-out Like → auth gate; signed-in Like → heart fills
  `#C24C4C`, count 0→1, toggles back clean; typecheck + build green; **no schema change**.
- **S6 — Error monitoring (Sentry), wired + inert until a DSN:** so we learn a production break from
  the tool, not from a user. `@sentry/nextjs` with guarded instrumentation across all three runtimes —
  `sentry.server.config.ts`, `sentry.edge.config.ts` (middleware), and `instrumentation-client.ts`
  (browser) — each `Sentry.init` wrapped in an `if (DSN)` check, so **with no `SENTRY_DSN` it's a
  complete no-op** (same optional-infra rule as Redis/DB/email); it switches on the moment M adds the
  DSN on Vercel, no code change. `instrumentation.ts` loads the right runtime config and exports
  `onRequestError` (Server Components / route handlers / middleware); the client file exports
  `onRouterTransitionStart` (navigation errors). Session Replay off by default, `sendDefaultPii: false`
  (matches the never-leak-user-data contract). The CSP `connect-src` now derives Sentry's ingest origin
  from the public DSN (mirroring the Supabase-origin logic), so error reporting keeps working when the
  CSP flips to enforcing — and adds nothing while Sentry is off. Verified: typecheck + build green with
  no DSN set (fully inert). *Not exercised: live error capture needs a real DSN. Source-map upload
  (readable stack traces) is a later add — needs a Sentry auth token.*
- **S4 — Write rate limits + volume caps:** the S1 limiter (`lib/ratelimit.ts`) now also guards every
  per-user community write — `writeList` (30/day), `listItem` (120/min), `comment` (8/min), `follow`
  (30/min), `save` (40/min), `vote` (60/min), `report` (8/5-min) — each one line after the existing
  `requireVerifiedUser` gate, keyed by **user id** (the paid routes are keyed by IP). Deletes, edits
  and unfollows are deliberately uncapped. Plus a **hard cap** `MAX_ITEMS_PER_LIST = 250`, enforced by
  a real count (`countListItems`) **independent of Upstash** — a correctness bound, not a burst guard —
  returning a friendly 409 `list_full`. Like S1 the rate limits are **fail-open and inert until the
  Upstash vars are set** (so they're off locally and until M adds the Vercel env vars), while the
  250-item cap is always on. Verified: `checkLimit` fail-opens (allows) with no Upstash so writes are
  never blocked by the absent dep; `countListItems` returns the true count (2 on the seed list);
  typecheck + build green. *429 enforcement itself can only be exercised once Upstash is configured —
  the same reused, already-shipped S1 sliding-window mechanism.*
- **S7c — Password reset UI:** `AuthModal` had sign in / sign up / upgrade but **no "forgot
  password"**, so the Supabase reset-email template (which S3 configures) had nothing to trigger it —
  a gap that would have surfaced the moment SMTP went live. Added a **reset** mode to the modal
  (a "Forgot password?" link in sign-in → email-only form → `resetPasswordForEmail` with a neutral
  "if that email has an account…" notice that never reveals whether an address is registered), and a
  new **`/auth/reset`** page to set the new password. The reset link routes through the existing
  `/auth/callback?next=/auth/reset` — the callback now honours a **same-origin `next`** (root-relative
  only, so it can't become an open redirect), exchanging the PKCE code into a short-lived recovery
  session before landing on the form. `/auth/reset` **guards the session**: no recovery session → an
  "invalid or expired" card instead of a form that can't work. Same `emailRedirectTo`/allowlist
  dependency as S3. Verified live: the sign-in modal shows Forgot password; reset mode hides the
  password field + Google/guest and shows "Send reset link" + "Back to sign in"; the round-trip
  restores; `/auth/reset` signed-out shows the invalid-session guard; console clean, build green.
  *The actual email + the recovery `updateUser` can only be exercised once SMTP (S3) is configured —
  same limitation as S3 itself.*
- **S7a — Account deletion (GDPR right to erasure):** there was **no delete-account flow at all**, and
  the schema made adding one dangerous: every FK from `profiles` was `ON DELETE CASCADE`, so deleting
  an account would have **hard-deleted every public list that person curated** (404ing every shared
  link) and — because `comments.parent_id` cascades too — **deleted other people's replies** to them.
  Migration **0008** flips `lists.owner_id` and `comments.user_id` to **nullable + `ON DELETE SET
  NULL`** (non-destructive: constraints and nullability only). The confirmed policy is **erase the
  person, keep the community**. `lib/account/delete.ts` runs the erasure in a deliberate order —
  private lists deleted, comments scrubbed to tombstones (`body` cleared, `hiddenBy: "author"`, reusing
  the G9 pattern that keeps thread trees intact), then the Supabase auth user deleted, whose cascade
  clears profile/saves/follows/votes/activity while the two new SET NULLs preserve public lists and
  comment tombstones. `DELETE /api/account` is gated by `requireUser` (not `requireVerifiedUser` — a
  guest is a real row and must be erasable) and takes the id from the **session**, never the body.
  New `/settings` page (linked from the account menu; future home of notification prefs +
  unsubscribe) → `DeleteAccountDialog` on the L1h `Modal` shell, requiring the handle typed exactly;
  the destructive button is **ink, not a danger colour** (`processed` is classification, never a
  control, per DESIGN.md — the system has no red). RLS needed no change: `owner_id = auth.uid()` is
  never true for `NULL`, so an orphaned list is editable by nobody. Verified by a throwaway-account
  E2E script (`scripts/check-account-deletion.ts`, **13/13 checks**, self-cleaning) — notably **"the
  OTHER user's reply survives"** — plus a clean Supabase security advisor (no new findings), 401 on the
  signed-out route, and a green build. *Not exercised: the signed-in dialog click-through — the browser
  session was signed out and signing in needs credentials; the deletion logic is covered by the script.*
  **S7's unsubscribe half stays open** — there are no notification emails yet (N2), and Loops carries
  its own unsubscribe for marketing.
- **S3 — Custom SMTP (code fix + runbook; the setup itself is M's):** S3 is an account, an API key, a
  dashboard form and DNS records — none of it doable from the repo. What *was* doable turned out to
  matter: `AuthModal` called `signUp()` (and the guest→account `updateUser()`) **without
  `emailRedirectTo`**, so confirmation links fell back to the project's **Site URL**. If that's still
  `localhost:3000` — the default during dev — every production signup mails someone a **localhost
  link**, which is exactly the silent "signup breaks at launch" failure S3 exists to prevent. Both
  calls now pin `${window.location.origin}/auth/callback`, so a link works from production, a preview
  deploy or local dev and lands on the route that exchanges the PKCE code for a session. *This only
  works together with the Supabase **Redirect URLs** allowlist* — documented. Added
  [`docs/EMAIL_SETUP.md`](EMAIL_SETUP.md): the full runbook (Resend domain on a sending subdomain,
  SPF/DKIM/DMARC with a `p=none`→`quarantine`→`reject` progression, the exact Supabase SMTP fields,
  URL configuration, the auth rate-limit that bites at launch, and end-to-end verification incl.
  checking SPF/DKIM/DMARC all PASS in Gmail). Flagged along the way: **there is no password-reset UI**
  — `AuthModal` has no "forgot password", so the reset template has nothing to trigger it.
  **Not verifiable here:** the email path can't be tested until SMTP is actually configured, and I
  didn't create test accounts in Supabase to try.
- **L4 — Seed supply (tooling; content still blocked):** `scripts/seed-supply.ts` +
  `npm run db:seed-supply`. **Dry-run by default** — it prints the plan and the spend estimate and
  writes nothing until `--commit`. It creates the four official accounts and the curated lists, and
  analyses every product through the **same pipeline a user's paste uses** (Firecrawl → Claude extract
  → Claude analyse → ingest), so seeded lists carry real label-derived breakdowns rather than
  hand-written ones. Safety properties, all deliberate: **no saves/follows/votes are ever written**
  (the locked "seed supply, never fake demand" rule); accounts are created **password-less** so the
  script never handles credentials (set them in Supabase); URLs are validated against
  `SUPPORTED_RETAILERS` *before* any spend and it refuses to commit if any fail; a list's products are
  analysed *before* the list is created, so a mid-run failure leaves nothing half-built and a re-run
  retries cleanly. Verified: dry run reports 4 accounts / 4 lists / 0 products and exits without
  writing; the retailer guard rejects a Mercadona URL and accepts Tesco/Target. **Still blocked on
  M/J:** the editorial product picks per list, spend authorisation (~20 analyses), the dev-vs-prod
  target, and "Mercadona essentials" — Mercadona isn't a supported retailer, so that fifth list can't
  be built until mercadona.es joins the retailer set (Tier C).
- **L2 — Social sharing (the growth loop):** Share was a single button that called
  `navigator.share({url})` and fell back to the clipboard — on desktop, where `navigator.share`
  usually doesn't exist, that silently meant "Link copied" with no channel choice, and it never shared
  the **card image**. It now opens a **`ShareSheet`** (built on the L1h `Modal` shell, so Escape /
  backdrop-close / `role="dialog"` come free): the card preview, **WhatsApp · Telegram · X · Facebook**
  intent URLs (`lib/share.ts`, pure builders so the encoding is checkable), **Copy link**, **Save
  image**, and a native **Share…** that fetches the card, wraps it in a `File` and calls
  `navigator.share({files})` when `canShare` allows — the path that puts **Instagram in the OS sheet on
  mobile**. Surfaces without a card degrade to link-only (profiles). Reuses the existing
  `/api/og/list/[slug]` card; no new deps, routes or schema. Verified live: sheet opens through the
  Modal shell, all four channel `href`s correctly encoded with `rel="noopener noreferrer"`, card serves
  200/`image/png`, Save image has `download`, native Share… correctly hidden where `navigator.share` is
  absent, profile mount link-only, Escape closes, console clean. *(Copy-link's confirmation couldn't be
  exercised — the automated browser denies `clipboard.writeText`; the handler is unchanged from the
  shipped one.)* **Not in this slice:** a portrait/IG-optimised card, profile/product cards, and the
  product-page mount — the sheet takes any `cardPath`, so those drop in later. True one-tap IG Stories
  stays native-only (M1).
- **L1h — Modals V3 pass (per-screen port, 4 of 4) — completes the V3 design port (L1).** The three
  overlays had drifted, so they now share one shell: new `components/Modal.tsx` owns the backdrop,
  panel, Escape, backdrop-close and dialog semantics. **`ReportDialog` gained the most** — it had
  **no Escape handler at all**, and closed via `onClick`+`stopPropagation`, which fires when you press
  *inside* the panel and release on the backdrop (dragging to select text closed it under you); it now
  uses the `onMouseDown`+target-check the others already had, plus `shadow-hero`/`animate-rise`.
  `AuthModal` and the header `SearchOverlay` dropped their duplicated Escape effects. All three gained
  **`role="dialog"` + `aria-modal="true"` + `aria-labelledby`/`aria-label`** — none announced
  themselves as dialogs before. `AddToList` is an anchored popover (already Escape-aware) and was
  deliberately left out. Verified live: both reachable modals show the dialog semantics (auth's
  `aria-labelledby` resolves to its visible "Sign in" heading), Escape closes both, backdrop-press
  closes, **press-inside stays open**, console clean, build green. *`ReportDialog` needs a signed-in
  session to open, so it wasn't exercised in-browser — its behaviour now comes entirely from the shell
  proven on the other two.*
- **L1g — Profile V3 pass (per-screen port, 3 of 4):** carried L1e's editorial empty-state card to
  `/u/[handle]`. Both tabs' bare `text-sm text-muted` lines became warm cards: **Lists** empty →
  "No lists yet" + a **New list** CTA, **Saved** empty → "Nothing saved yet" with an owner variant
  ("Tap Save on any list…" + Browse lists CTA) and a visitor variant ("@handle hasn't saved any public
  lists"). Also fixed a **copy bug**: the Lists empty state addressed the profile owner in the third
  person ("@handle hasn't shared any public lists… when *they* make a list public"), but L5c 404s
  non-owners before that branch — only the owner ever sees it, so it now speaks to them directly.
  `FollowButton` already self-hides on your own profile, so no own-surface cleanup was needed.
  Verified live: visitor Saved-empty card (Playfair heading, `paper`/`rounded-2xl`, owner CTA absent),
  console clean, build green. *Owner-side variants are covered by typecheck/build + the identical L1e
  owner-branch pattern verified live earlier — the browser session had signed out, and signing in
  needs credentials.* Next: **L1h** modals.
- **L1f — Discover V3 pass (per-screen port, 2 of 4):** a consistency + DRY pass on the already-V3
  Discover screen. Extracted a shared `ProductRow` (brand-initial thumbnail + Playfair name +
  brand·retailer meta + the app's SVG chevron) and used it in both places product rows appeared —
  Discover's "Recently analysed" and `SearchBox`'s product results — so the two can't drift. The
  search **list** rows swapped their text `→` for the same `RowChevron`, so every row in the app now
  points the same way (no `→` glyphs left in results). Pure presentation; no data/route/behaviour
  change (debounce, `?q=` sync, filter pills untouched). Verified live: recently-analysed + product
  search + list search all render via the shared row with SVG chevrons, count line + filters intact,
  console clean, build green. Next: **L1g** profile · **L1h** modals.
- **L1e — Lists V3 pass (per-screen port, 1 of 4):** brought the Lists surfaces up to the L1c
  editorial bar. List-detail item rows drop the `01` zero-pad for a plain Playfair `1,2,3` (matches
  `IngredientRow`); **own-list cleanup** (Jitain's V3 note) hides the redundant "by @you" line
  (now "Your list") and the Save pill on your own list (Share + Edit stay); the empty state becomes a
  warm card that **leads with an *Add product* CTA** for the owner and a calm line for everyone else.
  `/lists`' three guidance states (signed-out / handle-pending / empty) became editorial empty-state
  cards with a Playfair line + the right primary action. `ListCover`'s stale "gradient" comment fixed
  (flat tints since L1a); `ListCard` already read V3, left as-is. Verified live across owner /
  non-owner / owner-empty / non-owner-empty (throwaway list created + deleted), grid intact, console
  clean, build green. Next per-screen passes: **L1f** discover · **L1g** profile · **L1h** modals.
- **L1d-2 — header search overlay (design port, slice 4b):** "search is the homepage" is now reachable
  from every page. A compact search trigger in the shell bar (hidden on `/`, where the hero box already
  is; `/` key opens it anywhere) opens a dual-intent overlay (mirrors `AuthModal`): paste a supermarket
  URL → the homepage analyse flow (routes to `/?url=…`, which the homepage reads on mount, runs, and
  strips), type anything else → community search (`/discover?q=…`). The `looksLikeUrl` heuristic moved
  to `lib/retailers.ts` so the hero box and overlay share one intent test. The nav now collapses on
  mobile (`hidden sm:flex`, per DESIGN.md), leaving the bar to wordmark + search + account. No new deps.
  Verified live: trigger present off-home/absent on home, intent chip + Analyse/Search label, text →
  `/discover?q=`, URL handoff → `/?url=` → analyse runs + param stripped, console clean, build green.
- **L1d-1 — V3 app shell (design port, slice 4a):** the header is now a **full-width, sticky, blurred
  bar** across every app page instead of a header hand-copied inside each 640px column. `SiteHeader`'s
  `left` variant renders `sticky top-0 w-full border-b bg-canvas/75 backdrop-blur-md` with an inner
  container width-matched to the page (`width="tool"` default, `"wide"` = 1140px on Discover), and is
  lifted out of `<main>` to sit as a sibling so it can go edge-to-edge; each page's outer wrapper became
  a `flex min-h-screen flex-col` with `main` as `flex-1` (footer stays anchored). New `HeaderNav` client
  island marks the **active section** via `usePathname()` (active = ink, inactive = muted) and folds in
  the old admin gate (`AdminNavLink` removed). Welcome keeps its centered, non-sticky onboarding header
  (deliberately outside the shell). The **header search overlay** is the next slice (L1d-2). No data
  changes, no new deps. Verified live: sticky `top:0`/`z-40`/`blur(12px)`/`canvas/75` full-bleed bar,
  per-page inner width (640/1140), active pill on `/discover`·`/lists`·`/feed`, content clears the bar,
  pinned after scroll, product AddToList + AccountMenu (dropdown above content) intact, L1c count
  unchanged, console clean, `build` green.
- **L1c — V3 analysis view (design port, slice 3):** the analysis screen Jitain singled out. The
  ingredient count is now the **hero of the screen** — a big Playfair `natural`-green number (58px) +
  "ingredients in this product" (Playfair 23px) + an "In label order — N natural, N processed"
  subline (counts computed in code, never the model). The `ReadStrip` line folds into this
  `CountLede` block; `count` comes from extract so the number is striking immediately, even mid-stream.
  Rows lose the `01` zero-pad for a plain Playfair `1, 2, 3`; the tap-expand becomes V3's **two-beat**
  labelled blocks — uppercase "What it is" / "In this product" rubrics over each text (each beat
  hides when its field is empty). Design canon gained a documented **Statement** type step (the one
  Playfair-number-as-statement exception to counts-in-Inter). Verified live on `/p/oatly-…`:
  count = Playfair 58px `rgb(46,125,82)`, plain row numbers, both beats render, Nutrition tab intact,
  console clean. The `role` microlabel was **kept** (documented F rule) — V3's row drops it; Jitain to
  confirm. L1d (sticky app shell + header search overlay) + per-screen passes still open.
- **L1b — V3 homepage (design port, slice 2):** rebuilt the homepage to the V3 layout. New
  `HomeSearch` is the locked dual-intent box — paste a URL → analyse (existing flow); type anything
  else → `/discover` search (keyword now, L3 semantic later) — with a live intent chip. V3 hero
  (eyebrow rule, Playfair h1 with the italic-green "your", lede), SiteHeader nav → pills, and a new
  `PopularLists` strip (`/api/popular`, saves-only, hides when no signal). `UrlForm` removed.
  Verified live: hero + intent detection (text→Search, URL→Product link) + Popular card renders with
  a real save + all pages 200 + clean console. Sticky full-width shell + count view are L1d/L1c.
- **L1a — the V3 world (design port, slice 1):** the whole app moved to V3 "warm boutique" via the
  token layer — cream `#F4EDE3` canvas, warm paper `#FDFAF6`, brown-black ink `#2D2417`, warm
  hairline `#E8DDD0`, **Playfair Display** display font, warm-tinted shadows. `lib/cover.ts` covers
  are now flat V3 tints (no gradients); OG route matched. Natural/Processed (green/amber) untouched —
  still the one meaningful colour. Design canon (`DESIGN.md` + `.impeccable/design.json`) updated to
  V3 so the design hook enforces the new system. `muted` darkened to `#766753` for WCAG AA on cream
  (measured 4.71:1). Verified live: bg/type/covers/tags/contrast + clean console. Layout restructures
  (hero, dual-intent search, count view) come in L1b/L1c.
- **L6 — Save-only (upvote removal):** the product/list Upvote is gone — Save is the one social
  signal. Votes API narrowed to comments (product/list → 400), the UpvotePill mounts removed from
  the list + product pages, "Popular this week" ranks by saves alone, and the feed no longer shows
  "upvoted" stories. Comment upvotes stay (they drive the thread's Top sort). Non-destructive — no
  migration, historical vote rows kept. Verified: API matrix (400/400/200-toggle), all pages, no
  console errors. *Remainder still open: product-favouriting + add-to-multiple-lists (needs schema).*
- **L5c — visibility auto-public:** a profile is private until it has ≥1 public list. `/u/[handle]`
  now `notFound()`s for non-owners of a 0-public-list profile, `generateMetadata` goes generic when
  private (no name/bio leak), and the owner gets a "publish a list to go public" nudge (Share hidden).
  Discovery surfaces were already compliant (search returns no profiles; suggested-curators inner-joins
  public lists). Verified: non-owner 404, owner nudge, public profiles unaffected.
- **L7 — region prioritisation:** Discover's "Recently added" grid soft-ranks by "% of a list's
  products purchasable in the viewer's region" — a retailer→region map (`lib/config.ts` +
  `lib/retailers.ts`), availability math (`lib/region.ts`), a batch composition query
  (`getListsRetailers`) + `withRegionAvailability`, a server-side "Shopping in US/UK" toggle, and a
  neutral availability line on `ListCard`. No migration (derived from `products`/`offers.retailer`);
  never a hard filter. Region math + the live query verified.
- **V3 design review (21 Jul):** 3 decisions logged (Upvote→Save, auth flow, share-card gradients) +
  L7 added as a build order. (`53633c4`)
- **Security S5 — response headers:** `next.config.mjs` now sends HSTS, X-Frame-Options DENY,
  nosniff, Referrer-Policy and Permissions-Policy (enforcing) plus a **report-only** CSP whose
  `connect-src` includes the Supabase origin. Verified: headers present, sign-in works through the
  CSP, zero violations. Two dashboard toggles left for M (leaked-password protection, Vercel WAF).
- **Security S1 — rate limiting:** `lib/ratelimit.ts` (sliding-window, Upstash, fail-open) on the
  paid routes — extract/analyze/nutrition-context by IP, explain/products-analyze by user — with a
  friendly 429. Inert until the Upstash REST vars are set. (`9eaf514`)
- **Security S2 — guest-publish wall:** `requireVerifiedUser()` — guests may analyse but every
  community write (lists/comments/follows/votes/saves/reports) needs a real account; client controls
  get a shared `useAuthGate()` that prompts sign-in/upgrade. Captcha deferred.
- **Docs:** rewrote the README for the current (Phase 3) product; added this changelog and
  `ARCHITECTURE.md` as the living technical reference.
- **Security plan (S-series):** audited shipped auth; recorded the hardening plan (rate limits,
  captcha + no-publish-for-guests, custom SMTP, account deletion). Not yet implemented — see
  `Baloo_Launch_Plan.md`. (`9eb4c97`)
- **Org pass:** archived 12 historical docs to `docs/archive/`, added CI (typecheck + build),
  allowlisted read-only MCP tools. (`58ad98a`, `0c2c837`)
- **Launch plan (beta):** V3 design direction chosen; save-only, search-as-homepage, seed-supply
  decisions locked. (`efeda08`)

## Phase 3 — Community platform (shipped)
- **P1–P2 — Product/Offer + analysis engine:** `offers` table, `analysis_status`, pg_trgm; a
  framework-agnostic pipeline (`lib/analysis/`), a resumable background analyse engine
  (`runAnalysisForProduct`), the identity short-circuit (known product → skip analysis, add an
  offer), offers RLS, and the `ANALYSIS_MAX_TOKENS` fix for silently-truncated long analyses.
- **G9 — Moderation:** reports, admin queue (`/admin`), soft-hide tombstones, self-delete,
  `requireAdmin`.
- **G8 — Comments + "Explain this":** threaded comments; an AI explanation card (`/api/explain`).
- **G7 — Signals:** saves + votes with a popularity ranking.
- **G6 — Follows + feed:** the social graph, `/feed`, and the `activity` event log.
- **G5 — Discovery + profiles:** `/discover`, public `/u/[handle]` profiles, cross-entity search.
- **G4 — Lists:** create/edit, public list pages, covers, OG share images, add-to-list.
- **G3 — Canonical catalog:** dedupe on `canonical_key`, product pages (`/p/[slug]`), shared
  ingredient cache, ingest into Postgres.
- **G2 — Accounts:** Supabase Auth (email/Google/guest), `requireUser`, `/welcome` handle setup.
- **G1 — Foundation:** Drizzle schema, lazy DB client (optional-infra), RLS policies, seed/check
  scripts.

## Phase 2 — Nutrition + richer analysis (shipped)
- **Order D — Homepage board:** live "recent scans / top retailers" board over Redis, load-time only.
- **Order F — Progressive ingredient list:** collapsed rows (rank, name, %, role, N/P) unfolding to
  the full explanation; neutral `role` + one-sentence `product_summary`.
- **B1–B4 — Nutrition:** verbatim panel extraction, UK reference intakes (presets), all maths in
  code (`lib/nutrition.ts`), a neutral nutrition tab with the always-on disclaimer — no scores.
- **Order C — Scan logging:** fire-and-forget `recordScan` (no PII) powering the board.
- **Order A — Richer descriptions:** rewritten nutritionist prompt.

## Phase 1 — The tool (shipped)
- URL → Firecrawl scrape → Claude extract → streamed per-ingredient analysis, with a 7-day Redis
  URL cache, optional Loops email capture, and the single friendly-error contract. Runs with no keys
  via the mock pipeline.
