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

`lib/sharecard/generate.ts` renders the hero with **OpenAI `gpt-image-1`** (image *edit*, with the
packshots passed as references to keep the real packaging) and uploads the PNG to **Supabase Storage**
(public `share-heroes` bucket), returning the public URL. fetch-based, no SDK — `lib/` stays portable.
Used by both the offline job and the lazy trigger.

Needs these **server-side** env vars: `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_SUPABASE_URL` (+ a public `share-heroes` bucket). Without them generation is a no-op and the
card falls back to the flat packshot. To swap providers (Higgsfield, fal.ai, Replicate) change
`renderHero()` only. In testing Higgsfield `marketing_studio_image` cleaned messy OFF shop-shelf photos
into a studio still life (~2 credits / ~30s); `gpt-image-1` is the default for lowest setup friction.

### The prompt (verbatim intent)

> Editorial product still life: {one product | the products arranged together as a neat group — A, B and
> C}, presented on a warm cream marble surface in soft natural daylight from the left, with gentle, long,
> soft shadows. Calm, premium, boutique still-life look; warm cream-beige seamless background with
> generous negative space above the products. Keep each product's real packaging, brand logos, and
> colours accurate and legible. Studio-clean: no shelves, no price tags, no clutter, no people, no added
> text. Magazine-quality.

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
| Full editorial 3-format card (Chromium) | **planned** (V2) |
| Video | **planned** (after images) |
