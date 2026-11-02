# Session context — start here (cross-session continuity)

> Each Claude/agent session starts blank. It only knows what's in this repo, what the user pastes, or
> (when available) Notion memory. The Notion workspace is on the free plan and has hit its block limit,
> so Notion memory can't be written yet — **this file is the durable memory in the meantime.**
>
> **End-of-session rule (standing instruction from Miquel):** before wrapping up any session, update this
> file to reflect new state and decisions, and update `docs/CHANGELOG.md` + any other doc a change
> touched. This is part of "done". If Notion memory becomes writable later (workspace upgraded), mirror
> this context there too (see `notion://docs/memory`).

## Where things live (so nothing gets re-derived)
- **Code:** this repo, `baloo-ingredient-analysis/Baloo-landing-page`. Deep reference in `docs/`
  (ARCHITECTURE, CHANGELOG, SHARE_CARDS), root `CLAUDE.md`, `PRODUCT.md`, `DESIGN.md`,
  `Baloo_Launch_Plan.md`, `docs/PRE_LAUNCH.md`.
- **Web Supabase project:** `pppwlwelzhyizlphxcfp`. **Engine (Igor's) Supabase:** `rahjnurtpwygtaayzfgi`.
- **Notion:** `Baloo_Project_Hub` is the working board. The **17-screen web inventory** is the
  "Screen by screen" doc (shared as a PDF, 13 Oct 2026) — the current web app, the starting point for
  the redesign. The **mobile app is still to design**. (This doc is NOT in the repo; it lives in Notion /
  as a shared PDF — ask Miquel for it rather than trying to recreate it.)
- **Designer Kat** starts ~late Oct 2026 and owns visual design/UX (web + the mobile app screens).

## The 17 web screens (from the "Screen by screen" doc, 13 Oct 2026)
Home/tool · Search results · Product page · Ingredient expanded · Nutrition · Discover · List page ·
Profile · Feed/Following · Comments/discussion · Pantry · New list · List editor · Lists empty ·
Sign-in · Settings · Moderation. Mobile app screens: still to design.

## Already built — don't rebuild (check here first)
- **Language / i18n shell is DONE** (Jitain's "UI shell for languages" big win). `lib/i18n/` has it all:
  `config.ts` (locales `en`/`es`, `localizePath`/`stripLocale`, gated behind `NEXT_PUBLIC_I18N_ENABLED`),
  `server.ts` (`getLocale`/`getServerDictionary` via the `x-locale` header), `context.tsx`
  (`LocaleProvider`/`useT`/`useLocale`), a 221-line typed `dictionaries.ts` (`es` is `typeof en`, with
  **real Spanish**), `metadata.ts`, `useLocalizedRouter.ts`, plus `middleware.ts` (routes `/es` →
  `x-locale`, strips the prefix) and `components/LocaleToggle.tsx` / `components/i18n/LocalizedLink.tsx`.
  ~20 surfaces are wired. It's OFF until the engine serves Spanish content. Remaining work is only
  *extending dictionary coverage* to the not-yet-wired screens (product/list pages, settings, editor,
  moderation, profile) — speculative while the flag is off, so not urgent.
- **AI-bot text (llms.txt) is DONE** (see below). **Share cards** — see the share-cards section.

## Guardrail that never moves
- **Score-free, forever.** No score, rating, traffic-light, or good/bad verdict anywhere. The
  Natural/Processed pill is the only meaningful colour.

## Share cards — current state (28 Oct 2026, branch `fix/bgremove-removebg`)
- **Built:** packshot ingestion (`products.image_url`); a Claude-vision **packshot quality detector**
  (`lib/sharecard/packshotQuality.ts`: `studio_3d/flat_scan/lifestyle/unusable` + pure `planHero`
  ladder); the image ladder **author cover (`lists.cover_url`) → real clean packshot → designed no-photo
  card → brand**; cards `editorialCard` (4:5 photo), `designedCard` (4:5 no-photo list), `wideCard`
  (1.91:1 unfurl), `productCard` (4:5, ingredient-first with N/P pill, photo-free).
- **Formats done — lists:** feed 4:5, story 9:16 (`?format=story`), unfurl 1.91:1. **Product:** 4:5 done.
- **Accuracy rule (Jitain, non-negotiable):** never AI-invented packaging. The hybrid composites the
  REAL Open Food Facts cutout onto a *generated backdrop* — not generative packaging. The generative
  hero path (Higgsfield marketing_studio) is still live and is the only thing that can produce a *wrong*
  card; recommendation on the table is to keep it OFF for launch and rely on real-photo + designed cards.
- **Hybrid compositor — AUTOMATED + VERIFIED END-TO-END (28 Oct 2026).** `lib/sharecard/composite.ts`
  (sharp: scale + place + contact shadows, layouts for 1–4) + `bgRemove.ts` (**remove.bg** background
  removal, cutouts cached in Supabase) + shipped backdrop `lib/sharecard/backdrops/cream-marble.jpg`. The
  PRIMARY hero renderer in `generate.ts` (`renderWithCompositor`); generative off unless `HERO_GENERATIVE=1`.
  Detector widened so clean **flat** fronts also composite (Jitain's call) — **later narrowed, see the 2 Nov
  quality pass below**. Ran the full pipeline live:
  real Coca-Cola Energy cutout → cream-marble backdrop → stored at `lists.hero_url` (list
  "kids-favourites-decoded"). remove.bg returns a clean cutout in ~8s and is **free** for OFF packshots
  (≤0.25MP → 0 credits). (Higgsfield has no plain bg-removal REST endpoint — its REST is generative — so
  `bgRemove.ts` calls **remove.bg**.)
  - **Four `db:heroes` script-path bugs fixed** (they only bite outside the Next.js runtime): backdrop now
    read from disk on a `file:` URL (Node `fetch` can't read `file:`); `lib/db/index.ts` forces `ssl:
    'require'` for Supabase (local `DATABASE_URL` loses `?sslmode=require` on every password reset);
    timeouts on remove.bg (60s) + vision grading (30s); `scripts/generate-heroes.ts` calls
    `process.exit(0)` (postgres.js pool otherwise keeps a finished run alive, looking like a hang).
  - **⚠️ Supabase key rotation gotcha (local only):** the project's keys were rotated via the Vercel
    integration — legacy anon/`service_role` JWTs are **disabled**. A stale `eyJ…` service_role key in
    `.env.local` fails Storage uploads with `signature verification failed` even though it *looks* valid.
    Use the new **`sb_secret_…`** key (dashboard → Settings → API Keys) as `SUPABASE_SERVICE_ROLE_KEY`;
    the public key is now `sb_publishable_…`. Vercel/prod already has the rotated keys. See `SHARE_CARDS.md`.
- **Quality pass (2 Nov 2026) — compositor is a BONUS, designed card is the DEFAULT.** A real OFF photo
  (an Oreo) composited poorly (low-res, cropped, shot on a shelf) and read as cheap on the marble. The
  compositor's ceiling is the OFF photo, and much of the catalogue is weak, so: **(1) full-res source** —
  `fullResOffImageUrl()` pulls OFF's `…full.jpg` instead of the `…400.jpg` thumbnail before bg-removal;
  **(2) stricter gate** — `usableForHybrid` now requires `studio_3d` AND confidence ≥ 0.75 (was any clean
  3D/flat at ≥0.5); the classifier prompt rejects cropped/cluttered/low-res shots → they fall to the
  designed card (reverses the "flat fronts too" widening — flag with Jitain); **(3) resolution floor** —
  `compositeHero` drops cutouts < 500px; **(4) `db:heroes --ids a,b,c`** to re-render specific products.
  - **⚠️ REAL BUG FOUND + FIXED — card fonts never loaded in the Node runtime.** `cardFonts.ts` (and
    `loadBackdrop`) used `fetch(new URL('./asset', import.meta.url))`, which throws in Node (a relative
    `/_next/static/media/…` path in the Next server). So **every list card was silently falling back to the
    flat `igCard`** — the editorial AND designed cards were not rendering in the running app. Both loaders
    now read from disk. Verified locally: editorial card (Coke hero) and designed card both render. **Likely
    affects Vercel's nodejs runtime too — VERIFY on a preview deploy** (may need `outputFileTracingIncludes`
    for the fonts/backdrop).
- **Video/reel share — EXPERIMENT DONE (27 Oct 2026), it works & is shareable.** Winning approach:
  render the 9:16 card → **first-frame image-to-video** (Higgsfield `grok_video_v15_lite`, role
  `start_image`). The card is literally frame 1 so text/labels stay crisp; the model only adds subtle
  premium motion (slow push-in, drifting light). ~20 credits / 5s at 1080p. (seedance treated the image
  as a *reference* and regenerated → text risk; avoid for this.) Not yet wired into code — it's a
  validated manual flow.
- **Other pending:** profile share card + product unfurl still flat; category illustrations for the
  designed card (Kat); OFF image attribution column. (Many list heroes will be 1–2 products, not 4 — the
  quality detector drops messy OFF packshots, so richer packshots are the lever for fuller scenes.)

## Live launch blocker
- **baloo.life still serves the OLD Figma Make pitch deck, not the Vercel app** → all SEO + llms.txt /
  AI-bot text is inert live until the domain points at Vercel. Owner: Miquel. The rest of the remaining
  launch work is ops/decisions in `docs/PRE_LAUNCH.md` (owners M = Miquel, J = Jitain); the code side
  (beta features + S-series hardening) is code-complete.

## People
- **Miquel** — owns the web (solo; newer to some infra, learning). Writes in Spanish; wants SHORT,
  humanized replies (summarize hard, no walls of text); group-chat drafts in first person. Develop on the
  designated feature branch, commit + push when done (attribution footer required), don't rebuild what
  exists (check repo + Notion first), confirm before outward/irreversible actions and before spending
  (e.g. Higgsfield credits). Values honesty about limits over false confidence.
- **Jitain** — co-founder / product lead. Cares most about **accuracy** (never a wrong or AI-invented
  product image — core to trust); set the share-card mockup direction; champions score-free. Owns
  product/brand decisions: voice/tone, core message, community-at-launch, naming (app vs web), legal.
- **Igor** — owns the recognition engine ("PureScan") on a separate Supabase, connected via the versioned
  `/api/v1` HTTP API (decision: do NOT merge the two backends). Engine returns name/brand/category/size +
  the two axes, score-free; it does **not** expose a product image URL. Cautious about AI risk; wrote the
  Oct 2026 competitor analysis. Engine presentation lags the web — don't flip `ENGINE_FIRST=1` in prod
  until he polishes.

## AI-bot text (one of Jitain's "big wins") — already done in code
`app/llms.txt`, `app/list/[slug]/llms.txt`, `app/p/[slug]/llms.txt` + JSON-LD (`lib/seo.ts`) + AEO
(`lib/listMeta.ts`) cover the home/list/product bot-text spec. Inert live only because of the domain
blocker above.
