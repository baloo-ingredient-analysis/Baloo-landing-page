# Session summary — share cards, accuracy, continuity (23–27 Oct 2026)

What shipped this session and *how*, on branch `fix/instagram-share-desktop-v9vkps`. The deep reference
is [`SHARE_CARDS.md`](SHARE_CARDS.md); cross-session context lives in
[`SESSION_CONTEXT.md`](SESSION_CONTEXT.md).

## Share-card system
- [x] **Packshot ingestion** — threaded `image_url` through every ingest path + Open Food Facts barcode
  backfill + og:image capture on the web paste flow, so there's always a real photo to build from.
  Non-clobbering (a later imageless scan can't wipe a good packshot).
- [x] **Hero storage + generation engine** — `products/lists.hero_url` (migration `0019`) + a fetch-based,
  portable provider (`lib/sharecard/generate.ts`); generate-once-and-cache, never in the request path.
- [x] **Image provider: Higgsfield primary** — keeps brand logos faithful; OpenAI is only a keyless-dev
  alternative, never a per-call failover (it garbles labels, which would break the accuracy rule).
- [x] **Lazy-on-first-share** — the first share triggers one background render behind an atomic
  claim-guard (no duplicate spend); every share after is instant.

## Accuracy — the crux (Jitain's rule: never AI-invented packaging)
- [x] **Hybrid compositing validated** — generate only the *backdrop*; composite the **real OFF cutout**
  on top. Tested across varied lists → jars/bags/cartons work; flat scans & lifestyle shots don't, so
  ~half the catalogue is too messy to use raw.
- [x] **Packshot quality detector** — one Claude vision call grades each photo
  (`studio_3d / flat_scan / lifestyle / unusable`); a pure, unit-tested `planHero` ladder turns grades
  into a strategy and gates what ever reaches the image model.
- [x] **Fallback ladder, wired** — **author cover → real clean packshot → designed no-photo card →
  brand**. Consent + accuracy first; a credit is only spent on a genuinely clean photo.

## Formats (the full set)
- [x] **Editorial card (Satori)** — the "Quiet Field Guide" mockup look: Playfair headline, Caveat
  accent, bundled fonts, generated hero.
- [x] **Designed no-photo card** — title + numbered product list + botanical motif; always accurate,
  free, renders for any list.
- [x] **Feed 4:5 · Story 9:16 · Unfurl 1.91:1** — same components, one `?format=story` switch; the
  unfurl upgraded `/api/og/list` from the old flat card.
- [x] **Product card** — ingredient-first with the Natural/Processed pill, **photo-free by design**
  (always accurate, zero image-rights risk).

## Experiment
- [x] **Card → reel** — proved **first-frame image-to-video** (Higgsfield `grok_video_v15_lite`,
  `start_image`) keeps text crisp and adds premium motion; ~20 credits / 5s. The naive
  "generate a video from the card" route distorted text — the trick is first-frame i2v.

## Engineering hygiene
- [x] **Branch hardened** — reviewed ~4,900 lines; fixed 3 real bugs (product story aspect ratio,
  hero-gen timeout budget vs. the 60s function limit, provider-intent wording).
- [x] **Green throughout** — typecheck clean, 142 tests passing; everything committed + pushed.

## Continuity (the meta-fix)
- [x] **`SESSION_CONTEXT.md`** — durable cross-session memory (where things live, people, state,
  guardrails), pointed to from `CLAUDE.md`. Built because Notion memory was empty **and** its workspace
  is at the free-block limit.
- [x] **Standing "update docs before wrapping up" rule** + an **"already built — don't rebuild" list**
  (after nearly rebuilding the key-screens doc *and* the i18n shell — both already existed).

## Still open (not this session's to close)
- Automate the hybrid compositor (prototyped by hand). Video wiring into the share sheet (validated, not
  built). Profile share card + product unfurl (design = Kat). Category illustrations (Kat).
- **Live blocker:** baloo.life still serves the old deck, not Vercel → SEO/llms.txt inert until the
  domain is pointed (Miquel). Recommendation on the table: keep the generative hero OFF for launch and
  rely on real-photo + designed cards (the only path that can produce a *wrong* card).
