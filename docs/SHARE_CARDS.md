# Share cards — the social growth loop

How a Baloo list or product becomes a ready-to-post social card with a real, presented product photo.
This is the "one-click social sharing" item on the beta launch track (`Baloo_Launch_Plan.md`).

The target look (set by Jetain, Oct 2026): a warm editorial card — the products presented on cream
marble in soft daylight, a serif headline, the curator's attribution, a CTA, the baloo wordmark — in
three formats: **IG feed (4:5)**, **IG story (9:16)** and the **link unfurl (1.91:1)**.

## The two layers

A share card is built from two independent layers, generated separately and composed:

1. **Editorial template (code, deterministic, on-brand).** Headline, small-caps rubric, the handwritten
   "Good food goes further" accent, attribution, CTA, the baloo wordmark, numbered picks — laid out per
   ratio in the Quiet Field Guide tokens (`DESIGN.md`). Free, instant, always on-brand.
2. **Generated hero (AI, the hard part).** The photoreal "presented product" scene. A product's flat
   packshot is restaged into one warm, clutter-free still life. This is the piece that makes the card
   look like the mockups rather than a flat tint.

Both must be **score-free** (the unbreakable guardrail): the hero is *presentation*, never a verdict,
and the template carries no rating.

## Pipeline

```
packshot  →  identify (mobile engine / barcode → OFF)  →  generate hero (image model)  →  cache  →  compose card
image_url                                                   hero_url                       DB        share route
```

- **packshot** — `products.image_url`. Captured at ingest (see "Packshot ingestion" below).
- **identify** — getting the *right* packshot is the real dependency. The mobile app engine's
  vision+barcode→OFF identification is what makes "this is the correct product's image" reliable
  (Igor's scan logic). Garbage packshot in = garbage hero out.
- **generate hero** — offline job, cached. Not in the request path.
- **compose card** — the share route renders template + hero.

## Packshot ingestion (shipped — Slice 1)

`products.image_url` is now populated across every flow, so there is an image to build a hero from:

- `lib/ingest.ts` threads `imageUrl` into the catalog write and, when a flow carried no image but has a
  barcode, backfills it from Open Food Facts (`getOffImageByBarcode`, best-effort, in `after()` — never
  blocks the user).
- `lib/offImport.ts` passes OFF's `image_front_url` through.
- The v1 mobile contract accepts `product.imageUrl` (the engine's captured front image).
- The upsert never lets a later imageless scan wipe a good packshot (COALESCE).

Barcode-less products (user pastes with no barcode) still have no packshot — only the mobile engine's
capture can fill those. That is the known gap, and the reason the mobile engine matters here.

## Hero storage + generation (shipped — Slice 2)

- **Storage:** `products.hero_url` / `lists.hero_url` (+ `hero_generated_at`), migration `0019`. Distinct
  from the user-set `lists.cover_url`. Optional-infra: null until generated; the card falls back to the
  flat packshot / flat card.
- **`lib/sharecard/prompt.ts`** — pure hero-prompt builder + reference-packshot selection. The validated
  prompt (below). Framework-agnostic, no image-API dependency, unit-tested.
- **`lib/sharecard/heroes.ts`** — DB helpers: products/lists needing a hero, and the setters.
- **`scripts/generate-heroes.ts`** (`npm run db:heroes`) — the offline job. Finds rows needing a hero,
  builds the prompt + refs, renders via an injected `HeroProvider`, stores via `HeroStorage` (Supabase
  Storage by default), caches the URL. `--dry-run` works with no provider so a keyless box can validate
  the queue and prompts.

### Generate once, cache, read in app

Heroes are **pre-generated and cached**, never generated per-share. A share is then instant, every card
for a list is identical, and the (small) render cost is paid once. Per-product heroes are reused anywhere
the product appears; a list hero is a composite of the list's top products.

## Hero generation — what's proven

Validated Oct 2026 against **Higgsfield `marketing_studio_image`**:

- **It works, including from bad inputs.** Fed three *messy* real OFF photos (Coke on a shop shelf with a
  price tag, Oreo on a dark counter, Doritos on a shelf edge with clutter behind), it returned a clean
  studio still life on cream marble — all clutter removed, every brand logo faithful and legible.
- **Cheap and fast:** ~**2 credits (~pennies) and ~30s** per render at 1k–2k, 4:5 / 9:16 native.
- **Caveat:** very small on-pack text (nutrition panels, net weight) can garble. Main brand marks and
  titles hold up; invisible at card size. Mitigate with higher resolution and framing.

### The provider

`lib/sharecard/generate.ts` renders the hero and uploads it to **Supabase Storage** (public
`share-heroes` bucket), returning the public URL. fetch-based, no SDK — `lib/` stays portable. Used by
both the offline job and the lazy trigger. The provider is chosen by which key is set:

- **Higgsfield Marketing Studio Image (primary)** — `HIGGSFIELD_API_KEY="KEY_ID:KEY_SECRET"`. Async:
  POST `api.higgsfield.ai/marketing-studio/image` with `image_urls` (the packshots) → poll
  `/requests/{id}/status` → `images[0].url`. Keeps brand logos/packaging faithful.
- **OpenAI `gpt-image-1` (fallback)** — `OPENAI_API_KEY`. Synchronous image *edit*. Cheaper setup, but
  it garbles brand text (tested: "Coca-Cola" → "Coca Coup"), so it's the fallback, not the default.

Plus storage: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` (+ the public bucket). Without a
provider or storage, generation is a no-op and the card falls back to the flat packshot. Swapping to
another provider (fal.ai, Replicate) means adding one `renderWith…()` function.

### The prompt (verbatim intent)

> Editorial product still life: {one product | the products arranged together as a neat group — A, B and
> C}, presented on a warm cream marble surface in soft natural daylight from the left, with gentle, long,
> soft shadows. Calm, premium, boutique still-life look; warm cream-beige seamless background with
> generous negative space above the products. Keep each product's real packaging, brand logos, and
> colours accurate and legible. Studio-clean: no shelves, no price tags, no clutter, no people, no added
> text. Magazine-quality.

## Packshot quality detector + fallback ladder (shipped — Slice 4)

The hybrid hero (composite the REAL product cutout onto a generated studio backdrop, so packaging text is
never AI-invented — Jitain's hard requirement) only looks right when the source packshot is a **clean 3D
studio photo**. Validated Oct 2026 across varied lists (jars, bags, cartons, bottles → excellent; a flat
front-face label scan → reads as a pasted rectangle; a serving-suggestion / lifestyle shot → breaks). As
~half the Open Food Facts catalogue is messy, packshots must be **sorted before compositing**.

- **`lib/sharecard/packshotQuality.ts`** — `classifyPackshot(url)` grades one image with a single Claude
  vision call (same "Claude is the extraction layer" philosophy): `studio_3d` | `flat_scan` | `lifestyle`
  | `unusable`. Optional-infra (no `ANTHROPIC_API_KEY` → null), best-effort (any error → null). Pure
  helpers `finalize()` and `planHero()` turn grades into a strategy; unit-tested in `packshotQuality.test.ts`.
- **The image ladder (whole-card priority, most-preferred first):**
  0. **Author cover** (`lists.cover_url`) — the curator's own chosen photo. Consented and always accurate,
     zero rights/accuracy risk; wins over everything and never triggers generation (Igor's "a cover the
     list author chooses", wired in the list share route).
  1. **Real packshot, faithfully presented** — `planHero` over the products' packshots:
     a. any confidently-clean 3D packshot → **`hybrid`** scene from those (brand-deduped, capped at 4);
     b. classifier fully unavailable → **`hybrid`** on what we have, `verified: false` (no regression);
     c. no clean 3D shot but a faithful flat packshot → **`flat`** (show the real packshot on a tint card).
  2. **Designed card** (`lib/sharecard/designedCard.tsx`) — no image available → a no-photo card: big
     title, author, the product names as a clean numbered list, a quiet botanical motif (Spotify /
     Letterboxd energy — Igor's suggestion #1). Always accurate, free, no rights risk; renders for any
     list, and is the permanent card for lists the detector sends to fallback as well as the interim while
     a hero generates. v0 visual — Kat (design) owns refining it, incl. per-category illustrations.

> **Accuracy guarantee (the crux of the Igor/Jitain thread):** the hybrid is **not** AI-generated
> packaging. Only the *backdrop + lighting* are generated; the packaging pixels are the **real** OFF
> cutout, unchanged — so it carries the same accuracy guarantee as showing the flat photo, just presented
> on cream marble instead of a flat tint. We never redraw, re-letter or invent a label (the prompt forbids
> it and the detector refuses messy inputs). OFF photos are free to reuse **with attribution** — crediting
> them is a to-do (no `image_source` column yet).
- **Wired as the gate** (`classifyAndPlanHero`) in both share routes and `generate-heroes.ts`: only a
  `hybrid` plan reaches the image model, so a flat-scan/lifestyle-only list keeps its faithful flat/brand
  card and never burns a generation credit. `--dry-run` skips classification to stay zero-spend.

> Note: this is the SELECTION gate. The automatic hybrid *compositor* (generate backdrop → cut out real
> packshots → composite with contact shadows), prototyped by hand this round, is the next slice; today a
> `hybrid` plan still goes through the generative provider below.

## Composing the card (Slice 3)

- **Now:** the portrait IG card (`lib/igCard.tsx`, used by `/api/share/{list,product}/[slug]`) renders
  the generated hero photo in its top band when `hero_url` is set, and falls back to the flat tint card
  otherwise.
- **Lazy-on-first-share:** when a list/product share card is fetched and has no hero yet (and generation
  is configured), the share route generates one in `after()` and caches it — so the FIRST share triggers
  one render, every share after is instant, and you only ever pay for products people actually share.
  Best-effort: a failure just leaves the flat card, never breaks the share. No scripts to run — deploy
  with the keys set and sharing populates heroes on its own. `npm run db:heroes` is the bulk/backfill
  alternative.
- **Next (V2 — the full editorial look):** the three-format editorial template (feed / story / unfurl)
  that matches the mockups pixel-for-pixel is best rendered with **headless Chromium** (Playwright is
  already available in the build image), for real serif fonts, the script accent, layered gradients and
  numbered badges that Satori can't do faithfully. The approved visual reference (built and reviewed in
  this work) is the share-card preview artifact. The route would: load list/product + `hero_url`, render
  the HTML template → PNG, cache it. The Satori path above is the interim, infra-light version.

## Status

| Piece | State |
| --- | --- |
| Packshot ingestion (`image_url`) | **shipped** — all flows incl. web paste (og:image); 27 backfilled |
| Hero storage + prompt + job | **shipped** (Slice 2) |
| Image provider (OpenAI `gpt-image-1`) + Supabase storage | **shipped** — needs the 3 env vars + bucket |
| Lazy-on-first-share generation | **shipped** |
| IG card uses the hero | **shipped** (Satori top band) |
| Editorial list card (4:5) — the mockup look | **shipped** (V2, Satori + bundled Playfair/Caveat/Baloo 2 fonts; `lib/sharecard/editorialCard.tsx`) |
| Editorial 1.91:1 unfurl (link previews) | **shipped** (`wideCard.tsx`, wired into `/api/og/list`; photo + no-photo, same ladder) |
| Editorial 9:16 story | **shipped** — `/api/share/list/[slug]?format=story`; same cards at 1080×1920, "Save for Stories" in the share sheet |
| Editorial product card (4:5 feed) | **shipped** (`productCard.tsx`) — ingredient-first with N/P pills, photo-free (always accurate); product hero gen removed as nothing displayed it |
| Editorial product unfurl (1.91:1) | **planned** — product OG still uses the flat ogCard (a landscape product layout is Kat's design) |
| Packshot quality detector + fallback ladder | **shipped** (Slice 4) — Claude-vision grade gates generation; only clean 3D packshots reach the model |
| Author cover wins over generated hero (consent-first) | **shipped** — `lists.cover_url` is the top rung of the list card |
| Designed no-photo card (title + numbered list + motif) | **shipped** (v0, `designedCard.tsx`) — the accurate/free fallback; Kat to refine |
| Automatic hybrid compositor (backdrop + real cutouts) | **planned** — prototyped by hand (validated across varied lists); automate next |
| Hero label fidelity (compositing vs generative) | **open** — generative models occasionally misspell packaging text; compositing real cutouts is the faithful alternative |
| Video | **planned** (after images) |
