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

## Share cards — current state (27 Oct 2026, branch `fix/instagram-share-desktop-v9vkps`)
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
- **Hybrid compositor — AUTOMATED (28 Oct 2026).** `lib/sharecard/composite.ts` (sharp: scale + place +
  contact shadows, layouts for 1–4) + `bgRemove.ts` (Higgsfield background removal, cutouts cached in
  Supabase) + shipped backdrop `lib/sharecard/backdrops/cream-marble.jpg`. It's now the PRIMARY hero
  renderer in `generate.ts` (`renderWithCompositor`); the generative path is off unless `HERO_GENERATIVE=1`.
  Detector widened so clean **flat** fronts also composite (Jitain's call). **⚠️ One open check:** the
  Higgsfield bg-removal REST path/shape (`bgRemove.ts` `HF_REMOVE_PATH`) couldn't be live-verified
  in-session (no key in env) — confirm with a live key and adjust if needed; everything degrades safely
  (no cutout → designed card) until then. Compositor itself validated locally against real cutouts.
- **Video/reel share — EXPERIMENT DONE (27 Oct 2026), it works & is shareable.** Winning approach:
  render the 9:16 card → **first-frame image-to-video** (Higgsfield `grok_video_v15_lite`, role
  `start_image`). The card is literally frame 1 so text/labels stay crisp; the model only adds subtle
  premium motion (slow push-in, drifting light). ~20 credits / 5s at 1080p. (seedance treated the image
  as a *reference* and regenerated → text risk; avoid for this.) Not yet wired into code — it's a
  validated manual flow.
- **Other pending:** automate the hybrid compositor (prototyped by hand; ~half the OFF catalogue is too
  messy, which is why the detector matters); profile share card + product unfurl still flat; category
  illustrations for the designed card (Kat); OFF image attribution column.

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
