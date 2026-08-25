---
name: Baloo
description: A warm field guide to what's in your food — brown-black ink on cream, one meaningful colour.
colors:
  ink: "#2D2417"
  muted: "#766753"
  line: "#E8DDD0"
  paper: "#FDFAF6"
  canvas: "#F4EDE3"
  natural: "#2E7D52"
  natural-soft: "#E7F1EB"
  processed: "#B5701F"
  processed-soft: "#F6ECDD"
  like: "#C24C4C"        # Order L8 — the one social colour; lists' Like heart only, never on food UI
  like-soft: "#F7E8E6"
typography:
  # The shipped ramp. There is no Tailwind fontSize scale yet, so sizes are arbitrary values in code
  # (text-[Npx]); these are the intentional steps that documents them. Serif = Playfair (headings),
  # Sans = Inter (text). Known one-offs still to snap to a step: 10, 28, 52, 58.
  # displayLg — homepage + /compare h1 at ≥sm
  displayLg:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "54px"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "-0.01em"
  # display — hero h1 base (bumps to displayLg at ≥sm)
  display:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "40px"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "-0.01em"
  # pageTitle — section h1 (feed, admin, profile)
  pageTitle:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1.15
  # headline — loading / section headings
  headline:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "23px"
    fontWeight: 400
    lineHeight: 1.2
  title:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.3
  # rowTitle — compact list-row product names (search, compare)
  rowTitle:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.3
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  # small — dense UI, controls, chips, meta (the workhorse sans size)
  small:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  # label — uppercase, tracked micro-label
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.12em"
  # micro — pills, tiny status/meta
  micro:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  lg: "8px"
  xl: "12px"
  "2xl": "16px"
  full: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.full}"
    padding: "10px 16px"
  button-ghost:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "6px 14px"
  tag-natural:
    backgroundColor: "{colors.natural-soft}"
    textColor: "{colors.natural}"
    rounded: "{rounded.full}"
    padding: "3px 10px"
  tag-processed:
    backgroundColor: "{colors.processed-soft}"
    textColor: "{colors.processed}"
    rounded: "{rounded.full}"
    padding: "3px 10px"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: "16px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "10px 14px"
---

# Design System: Baloo

> **V3 evolution (21 July 2026, Order L1a).** The direction Jitain chose — "warm boutique" — moved
> the system from near-white paper + Fraunces to **cream + Playfair Display**, and made **flat tints
> the law** (no gradients anywhere, including generated covers). Every named rule below carried over
> unchanged; only the material world got warmer. One deliberate deviation from the V3 mock: its
> muted `#8C7B68` fails WCAG AA (~3.5:1) on cream, so the `muted` token is the same hue darkened to
> `#766753` (~4.7:1, measured in-browser).

## 1. Overview

**Creative North Star: "The Quiet Field Guide" (V3 warm boutique)**

Baloo looks like a clear, plain-language reference you already trust — a warm field guide to the supermarket aisle, not a lab report and not an alarm. The surface is cream (`canvas` #F4EDE3) with brown-black ink (`ink` #2D2417); structure comes from thin warm `line` hairlines and generous whitespace, never from heavy chrome. An editorial serif (Playfair Display) carries the headings and the wordmark so the voice reads *considered and human*; a clean sans (Inter) does all the work of labels, controls, and data. Everything is unhurried and legible: the reader is here to understand, and the interface's whole job is to get out of the way of that.

The system is deliberately **restrained**. On the food itself — every ingredient and nutrition surface — colour means exactly one thing: the small green/amber Natural/Processed tags, and nothing else. That scarcity is the point: because nothing else shouts, the one meaningful signal is instantly legible, and no colour there can be mistaken for a health verdict. The social layer adds exactly one more reserved colour — the warm rose-red **Like** heart (Order L8) — kept entirely off ingredient/nutrition UI so the two meanings never blur. Everywhere else is a disciplined warm neutral. Depth is flat-by-default: cards sit on the canvas inside a 1px hairline, and the faint card shadow only appears as a response to hover. Generated covers and tiles are **flat tints, never gradients**. Reading columns are capped narrow (640px) so prose stays comfortable.

This system explicitly rejects two moods. It is **never clinical or medical** — no sterile chart-grids, no warning banners, no health-record chill. And it is **never alarmist** — no scare language, no red "danger" states, no "toxic ingredient" theatre. Baloo explains; it does not diagnose and it does not frighten.

**Key Characteristics:**
- Brown-black ink on cream paper; warm hairlines and whitespace over boxes and shadows.
- Playfair Display serif for the calm editorial voice; Inter sans for all the working UI.
- One meaningful colour on the food (green/amber = Natural/Processed); one reserved social colour (rose-red = Like); everything else warm neutral.
- Flat at rest — flat cover tints, no gradients; motion and shadow appear only as a response to state.
- No score, no rating, no traffic-light verdict — anywhere, ever.

## 2. Colors

A near-monochrome ink-on-cream palette with two reserved accents that never leave their lanes: the two-tone green/amber classification accent (on the food) and a single rose-red social accent (the Like heart).

### Primary
- **Brown-Black Ink** (#2D2417): The primary "colour" of the whole product — all body and heading text, and the fill for primary/active controls (buttons, the active Save state at 5% tint). Warm brown-black, not pure #000, so it sits kindly on cream.

### Secondary (semantic — classification only)
- **Field Green** (#2E7D52) on **Soft Sage** (#E7F1EB): The **Natural** ingredient tag. Used *only* to classify an ingredient as natural — never for buttons, links, or decoration.
- **Ochre** (#B5701F) on **Soft Ochre** (#F6ECDD): The **Processed** ingredient tag. The amber counterpart, again *only* as classification.

### Social accent (Order L8 — Like only)
- **Rose-Red** (#C24C4C) on **Soft Rose** (#F7E8E6): The **Like** heart on lists, active state. The one coloured social control, chosen to be unmistakably distinct from green/amber so a like never reads as a health verdict. Reserved to the Like pill — it must never appear on ingredient or nutrition UI, nor as a general button/link colour. (Save and Follow stay neutral ink; Save is private.)

### Neutral
- **Warm Paper** (#FDFAF6): Card, panel, and composer surfaces — the raised reading planes that sit on the canvas.
- **Cream Canvas** (#F4EDE3): The page background — the V3 warmth lives here. It makes Warm Paper cards read as gently lifted.
- **Warm Hairline** (#E8DDD0): Every 1px border, divider, and rule. The primary structural device of the whole system.
- **Warm Taupe** (#766753): Secondary text — bylines, meta, timestamps, captions. Deliberately darker than the V3 mock's #8C7B68 to hold ≥4.5:1 on cream; never lighten it "for elegance."

### Cover tints (generated, flat)
`#DCE6D5` sage · `#EADFC9` wheat · `#E7D8CE` clay · `#DFE4DE` mist · `#E3E7D9` celadon · `#EFE4D0` sand — the deterministic flat palette for generated list covers and product tiles (`lib/cover.ts`). Never gradients, never a traffic-light hue.

### Named Rules
**The One Meaningful Colour Rule.** Green and amber appear *only* as the Natural/Processed ingredient tags. Every interactive state — save, follow, primary buttons, selection — is **ink-tinted neutral** (ink border + `ink`/5% fill when active), never green or amber. If a saved control turned green, it would read as a health verdict; that is forbidden.

**The Ink-Not-Black Rule.** Text is `ink` (#2D2417), never `#000000`. Pure black on cream is harsh and clinical — the exact mood Baloo rejects.

**The Flat-Tint Rule (V3).** No gradients anywhere — covers, tiles, buttons, text. Generated covers are single flat tints from the cover palette.

## 3. Typography

**Display Font:** Playfair Display (with Georgia, serif fallback)
**Body Font:** Inter (with system-ui, sans-serif fallback)

**Character:** A high-contrast editorial serif paired with a neutral humanist sans — contrast on the serif/sans axis, not two similar families. Playfair Display carries the *voice* (wordmark, page titles, card titles, the AI's answer); Inter carries the *work* (body copy, controls, labels, counts, data). The serif makes Baloo feel like a knowledgeable friend writing to you; the sans keeps the app crisp and legible.

### Hierarchy
- **Statement** (Playfair 400–600, 52–58px, line-height ~0.85, `natural` green): The single hero *number* on the analysis screen — the ingredient count Jitain asked to "feel striking, or give a sensation that it's clean." One per screen; the deliberate exception to the counts-in-Inter rule below (a count set as the page's editorial statement, not a data field). Never used for more than one figure on a screen.
- **Display** (Playfair 400–700, 30–40px, line-height 1.1, tracking -0.01em): Page H1s and hero headlines — "Know what's in your food.", "Discover", the feed masthead. Fixed rem sizes per breakpoint, not fluid clamps.
- **Headline** (Playfair 400–600, 23px, line-height 1.2): Section headings — "Recently added", "Discussion".
- **Title** (Playfair 400–600, 17–19px, line-height 1.3): Card and list-item titles; the product name.
- **Body** (Inter 400, 15px, line-height 1.6): All prose — ingredient explanations, comments, descriptions. Cap prose at 65–75ch; the 640px reading column enforces this.
- **Label** (Inter 600, 11–12px, uppercase, tracking 0.12em): Small eyebrows and section rubrics ("Natural", day rubrics, "Explanation"). Used sparingly, as rubrics — not stacked above every section.

### Named Rules
**The Two-Voice Rule.** Playfair Display speaks (headings, the wordmark, Baloo's "Explain this" answer); Inter works (everything you operate). Never set a button, form label, or data value in the serif — with **one exception**: the analysis screen's hero ingredient count (the **Statement** step above), where a single figure is set large in Playfair *as* the page's editorial statement. One statement number per screen; every other count and value stays in Inter.

## 4. Elevation

Flat by default. Depth is carried by **1px `line` hairlines and paper-on-canvas layering**, not by shadow. Cards and rows sit inside a hairline border on the paper surface, lifted from the canvas only by the whisper-faint `card` shadow. Shadow is treated as a *response to state*: the slightly stronger `card-hover` appears on hover, and `hero` is reserved for the one genuinely floating element (the home input). There is no ambient drop-shadow everywhere; that would read heavy and app-store-generic.

### Shadow Vocabulary
- **Card (at rest)** (`box-shadow: 0 1px 2px rgba(45,36,23,0.04), 0 1px 3px rgba(45,36,23,0.05)`): The barely-there lift under a paper card sitting on canvas.
- **Card-hover** (`box-shadow: 0 4px 14px rgba(45,36,23,0.07), 0 2px 5px rgba(45,36,23,0.04)`): The hover response for interactive cards (list cards, product rows). Pairs with a border darkening to #DACDBD.
- **Hero** (`box-shadow: 0 1px 2px rgba(45,36,23,0.05), 0 10px 30px -12px rgba(45,36,23,0.12)`): Reserved for the single hero element (the homepage analyse input). One per screen, at most.

### Named Rules
**The Hairline-First Rule.** Reach for a 1px `line` border before you reach for a shadow. Structure the page with rules and whitespace; let shadow do only what a border can't (signalling hover-lift). If a surface has both a heavy shadow and a border, the shadow is wrong.

## 5. Components

### Buttons
- **Shape:** Full-round pills (`rounded-full`) for actions and controls; small radius (`rounded-lg`, 8px) for text inputs and menus.
- **Primary:** `ink` fill, white text, ~10px 16px padding. Hover darkens to `ink`/85%. Used for the single strongest action (Analyse, Post, Submit).
- **Ghost / Secondary:** `paper` fill, 1px `line` border, `ink` or `muted` text. Hover darkens the border toward `ink`/20% or washes to `canvas`. The default for most controls.
- **Focus:** Visible focus is required on every control; inputs use a `natural` border + 2px `natural`/20% ring.

### Chips / Tags
- **Natural/Processed pill:** `natural-soft`/`processed-soft` background, `natural`/`processed` text, full-round, ~10px uppercase-ish label. The only coloured component *on the food*; it is classification, never a control, and its colours never appear elsewhere.
- **Engagement pills (Save / Follow):** Neutral. At rest: `paper` + `line` border + `muted`. Active: `ink` border + `ink`/5% fill + `ink` text. Never green/amber, never the Like colour. (Save is private — the personal library signal.)
- **Like pill (lists only, Order L8):** The one coloured social control. At rest neutral (like Save). Active: `like`/40% border + `like-soft` fill + `like` text (rose-red #C24C4C) + a filled heart, count shown. Public signal — feeds Popular/Explore ranking. The `like` colour is reserved to this control and must never touch ingredient or nutrition UI.
- **"Soon" / deferred chip:** `paper` + `line`, `muted`, with a tiny uppercase "Soon" rubric.

### Cards / Containers
- **Corner Style:** `rounded-2xl` (16px) for cards and panels; `rounded-xl` (12px) for inline receipts and the AI answer card.
- **Background:** `paper` on a `canvas` page. Cover bands are **flat tints** from the cover palette.
- **Shadow Strategy:** `card` at rest → `card-hover` on hover (interactive cards only). See Elevation.
- **Border:** 1px `line`, always. The hairline is the card, more than the shadow is.
- **Internal Padding:** 16–20px (`md`).

### Inputs / Fields
- **Style:** `paper` background, 1px `line` border, `rounded-lg` (search fields use `rounded-full`).
- **Focus:** border shifts to `natural` with a 2px `natural`/20% ring — the one place the green appears on a control, and only transiently as a focus affordance.
- **Placeholder:** `muted`, but never below 4.5:1; it is real text, not decoration.

### Navigation
- **SiteHeader:** wordmark (Playfair 600) left; a quiet sans nav (Following · Discover · Lists) + account menu right; a centered variant on the homepage. Hairline `border-b` under it. Active nav item is `ink`; inactive is `muted`. Mobile collapses the nav, keeps wordmark + account.

### Signature Component — the "Explain this" card
The single card in an otherwise card-less comment thread. `paper`, `rounded-xl`, 1px `line`; a `canvas` header strip carrying a `natural` spark + the **Baloo wordmark** (no avatar — it must never look like a person) + an uppercase "Explanation" label; body in the two-beat "What it is." / "In this product." with a muted disclaimer above a hairline. It carries **no** vote or reply — you cannot vote on a fact. This component is where the brand's "community brings opinions, Baloo brings facts" principle becomes visible.

## 6. Do's and Don'ts

### Do:
- **Do** structure with 1px `line` hairlines and whitespace first; add shadow only for hover-lift.
- **Do** keep prose in the 640px reading column (`max-w-tool`), 65–75ch.
- **Do** set headings and the wordmark in Playfair Display; set every control, label, and value in Inter.
- **Do** keep every engagement control neutral — `ink` border + `ink`/5% fill when active.
- **Do** give the Natural/Processed tag a text label always, so meaning never depends on colour alone (WCAG 2.1 AA).
- **Do** use `ink` (#2D2417) for text, never `#000000`.

### Don't:
- **Don't** add a score, rating, 0–100 number, or red/amber/green traffic-light verdict anywhere. This is the one unbreakable rule.
- **Don't** let green or amber appear outside the Natural/Processed tags — no green "success" buttons, no amber "warning" states.
- **Don't** use **gradients** — anywhere. Covers, tiles, buttons and text are all flat (V3 rule, per Jitain).
- **Don't** make it feel **clinical or medical**: no chart-grid dashboards, no warning banners, no sterile health-record chrome.
- **Don't** use **alarmist "toxic ingredient" fear** language, red danger states, or scare imagery. Baloo is calm.
- **Don't** use `border-left`/`border-right` greater than 1px as a coloured accent stripe; use a full hairline border or a soft tint instead.
- **Don't** use decorative glassmorphism; emphasis comes from weight, size, and Playfair Display — not effects.
- **Don't** drop an ambient shadow on everything; a card with a heavy shadow *and* a border is over-built.
- **Don't** stack a tiny uppercase eyebrow above every section; the uppercase label is a rubric used sparingly, not scaffolding.
