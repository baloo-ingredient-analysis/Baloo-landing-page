# Baloo — Design Guide

> **The Quiet Field Guide** (V3, warm boutique). The full guide for anyone designing inside Baloo:
> the north star, the palette, the type, the components, and the decisions behind them.
>
> This is a readable, consolidated companion to the canon. The **sources of truth** are
> [`PRODUCT.md`](../PRODUCT.md) (strategy) and [`DESIGN.md`](../DESIGN.md) (visual system, tokens,
> named rules); the machine mirror is [`.impeccable/design.json`](../.impeccable/design.json). If this
> guide and those files ever disagree, those files win — update this to match.
>
> A visual, interactive version (live swatches, type specimens, rendered components) can be produced
> as an Artifact from the same content.

One rule sits above everything else: **Baloo explains; it never judges.**

---

## 1 · North star & who it's for

**"The Quiet Field Guide."** Baloo looks like a clear, plain-language reference you already trust — a
warm field guide to the supermarket aisle, not a lab report and not an alarm. Cream paper, brown-black
ink, structure from thin warm hairlines and whitespace. An editorial serif carries the voice; a clean
sans does the work.

- **Who it's for.** Everyday, **health-curious shoppers** — ordinary people who want to understand
  what's in a product without being scored, ranked, or scared. Not clinicians; they want plain language
  and a trustworthy read, quickly. A secondary, emergent audience are **curators** who build and share
  lists — but when needs conflict, **the everyday reader wins**: clarity and calm before power-user
  features.
- **What it does.** Turns a supermarket product into a plain-language breakdown of every ingredient —
  **what each thing is, and why it's in this specific product** — plus a neutral nutrition view, and
  lets people save products into shareable lists. Underneath, it's becoming a community food-discovery
  platform where **lists are the primary object** and Baloo's explanation sits under every item.
  Success is a habit and a community, not a one-off scan.
- **Personality.** Calm, knowledgeable, trustworthy — **a well-read friend who happens to understand
  food labels**, not a clinic and not a scanner. Educates before it persuades, never alarmist, chooses
  context over judgment.
- **Anti-references.** Never a **clinical/medical** app (sterile, chart-heavy, warning-laden). Never
  **alarmist "toxic ingredient" fear** content (scare tactics, "avoid these 5 poisons," fear as
  engagement). Both betray the calm, educational promise.

---

## 2 · The unbreakable guardrails

The soul of the product. Everything else can be redesigned; these are protected on every screen.

1. **Explain, never judge — the one rule.** No score, no rating, no 0–100, no traffic lights, *ever*.
   Baloo explains what's in food and lets the reader decide.
2. **Colour is meaning, not decoration.** On the food, one colour means one thing: the small
   green/amber Natural/Processed tags, nowhere else. The social layer adds exactly one more reserved
   colour — the rose-red Like — kept entirely off ingredient & nutrition UI so the two never blur.
3. **One analysis, reused everywhere.** A product's ingredient breakdown is generated once and attached
   wherever the product appears — never regenerated per view, never faked. The explanation *is* the value.
4. **Community brings opinions; Baloo brings facts.** The AI is something you *ask*; it never lectures,
   never authors the lists, and stays visibly distinct from human voices.
5. **Flat, calm, never clinical or alarmist.** Flat by default (flat tints, no gradients); shadow &
   motion only as a response to state. No chart-grid dashboards, no warning banners, no red danger states.

**Accessibility is part of the promise.** Target **WCAG 2.1 AA** — 4.5:1 body contrast, full keyboard
access with visible focus, honoured reduced-motion (the default), and the Natural/Processed tags
**always carry a text label**, so meaning never depends on colour alone.

---

## 3 · Colour

A near-monochrome ink-on-cream palette with two reserved accents that never leave their lanes.

### Ground & ink (the whole product)
| Token | Hex | Role |
|---|---|---|
| Ink | `#2D2417` | All text; fill for primary/active controls. Warm brown-black, **never `#000`**. |
| Muted taupe | `#766753` | Bylines, meta, captions. Held ≥4.5:1 on cream — never lighten it. |
| Hairline | `#E8DDD0` | Every 1px border, divider & rule. The primary structural device. |
| Warm paper | `#FDFAF6` | Cards, panels, composers — the raised reading planes. |
| Cream canvas | `#F4EDE3` | The page background — where the V3 warmth lives. |

### Classification accent — on the food, only
| Token | Hex | Role |
|---|---|---|
| Field Green | `#2E7D52` on `#E7F1EB` | The **Natural** tag. Never buttons, links, or decoration. |
| Ochre | `#B5701F` on `#F6ECDD` | The **Processed** tag. The amber counterpart, again only as a tag. |

### Social accent — the Like heart, only (Order L8)
| Token | Hex | Role |
|---|---|---|
| Rose-Red | `#C24C4C` on `#F7E8E6` | The **Like** heart on lists (active). Chosen to be unmistakably *not* green/amber, so a like never reads as a health verdict. Reserved to the Like pill — never on ingredient/nutrition UI. |

### Cover tints (generated, flat)
`#DCE6D5` sage · `#EADFC9` wheat · `#E7D8CE` clay · `#DFE4DE` mist · `#E3E7D9` celadon · `#EFE4D0` sand
— the deterministic flat palette for list covers & product tiles (`lib/cover.ts`). Never gradients,
never a traffic-light hue.

**The One Meaningful Colour Rule.** Green and amber appear *only* as the Natural/Processed tags. Every
interactive state — save, follow, primary buttons, selection — is **ink-tinted neutral** (ink border +
ink/5% fill when active). The single exception is the rose-red Like, reserved to its one pill. If a
saved control turned green it would read as a health verdict — forbidden.

---

## 4 · Typography

A high-contrast editorial serif paired with a neutral humanist sans — contrast on the serif/sans axis,
not two similar families.

- **Display font:** Playfair Display (fallback Georgia, serif) — *speaks*.
- **Body font:** Inter (fallback system-ui, sans-serif) — *works*.

| Step | Font / size | Use |
|---|---|---|
| **Statement** | Playfair, 52–58px, green | The single hero *number* on the analysis screen (ingredient count), set as the page's editorial statement. One per screen. |
| **Display** | Playfair, 30–40px, tracking −0.01em | Page H1s / hero headlines. |
| **Headline** | Playfair, 23px | Section headings ("Recently added", "Discussion"). |
| **Title** | Playfair, 17–19px | Card & list-item titles; the product name. |
| **Body** | Inter, 15px, line-height 1.6 | All prose. Capped 65–75ch by the 640px reading column. |
| **Label** | Inter, 11–12px, uppercase, tracking 0.12em | Small rubrics ("Natural", "Explanation"). Used sparingly. |

**The Two-Voice Rule.** Playfair speaks (headings, wordmark, Baloo's "Explain this" answer); Inter works
(everything you operate). Never set a button, form label, or data value in the serif — with **one
exception**: the analysis screen's hero ingredient count, set large in Playfair *as* the page's
statement. One statement number per screen; every other count stays in Inter.

---

## 5 · Layout, space & shape

- **Reading column.** Prose caps at **640px** (`max-w-tool`), 65–75ch. The one documented widening is
  **1140px** for card grids (Discover), where a reading column can't hold a grid.
- **Spacing scale.** `8 · 16 · 24 · 40px` (sm / md / lg / xl). Layout uses flex & grid `gap`, not
  stacked margins.
- **Corner radius.** `8px` inputs/menus · `12px` receipts & the AI card · `16px` cards/panels · `full`
  pills & controls.
- **The Hairline-First Rule.** Reach for a 1px hairline border before a shadow. A surface with both a
  heavy shadow and a border is over-built.

---

## 6 · Elevation & motion

Flat by default. Depth is carried by 1px hairlines and paper-on-canvas layering, not shadow. Shadow is a
*response to state*.

| Shadow | Value | Use |
|---|---|---|
| Card (rest) | `0 1px 2px rgba(45,36,23,.04), 0 1px 3px rgba(45,36,23,.05)` | Whisper-faint lift under a paper card on canvas. |
| Card-hover | `0 4px 14px rgba(45,36,23,.07), 0 2px 5px rgba(45,36,23,.04)` | Hover response for interactive cards; border darkens to `#DACDBD`. |
| Hero | `0 1px 2px rgba(45,36,23,.05), 0 10px 30px -12px rgba(45,36,23,.12)` | The one floating element (home analyse input). One per screen. |

**Motion vocabulary:** `rise` (cards settling in, translateY 6→0, 0.35s) · `fade-in` (view/state switch,
0.5s) · `pulse-dot` (the board's gentle live dot; the only looping motion). **Reduced motion:**
`globals.css` zeroes every animation under `prefers-reduced-motion` — non-negotiable.

---

## 7 · Components

- **Buttons.** Full-round pills. **Primary** = ink fill / white text (the single strongest action:
  Analyse, Post). **Ghost** = paper + 1px hairline (the default control). `rounded-lg` for text inputs.
- **Classification tags** (Natural / Processed). `*-soft` background, coloured text, full-round, always
  with a text label. The only coloured component *on the food*; never a control.
- **Engagement pills.** **Save & Follow** stay neutral — paper + hairline at rest; ink border + ink/5%
  fill when active. Save is private. **Like** (lists only, L8) is the one coloured social control:
  rose-red fill + filled heart + count when active; public signal, feeds Popular/Explore ranking.
- **Inputs / fields.** Paper + hairline, `rounded-lg` (search = `rounded-full`). On focus the border
  shifts to green with a 2px green/20% ring — the one place green touches a control, transiently.
- **Cards.** Paper on canvas, 1px hairline (always), `rounded-2xl`, `card` shadow at rest →
  `card-hover` on hover. Cover bands are flat tints.
- **Navigation.** Wordmark (Playfair) left; a quiet nav (Following · Discover · Lists — now line-icons
  with the word on hover) + account menu right. Active item ink, inactive muted. Hairline `border-b`.
- **Signature — the "Explain this" card.** The one card in a card-less comment thread. Headed by the
  **wordmark, never an avatar** (it must never look like a person), with a two-beat body
  ("What it is." / "In this product.") and a muted disclaimer. Carries **no vote or reply** — you cannot
  vote on a fact. This is where "community brings opinions, Baloo brings facts" becomes visible.

---

## 8 · The signals model (and its story)

How people react to content is deliberately minimal — and it's the clearest example of how decisions
get made here.

- **Then — Save-only.** A list carried *one* signal (Save) to stay calm and judgment-free. But it left
  popularity invisible and gave "save" two jobs (keep & endorse).
- **Now — Like (public) + Save (private).** A list carries *two*: a public **Like** (rose-red heart,
  count shown, feeds ranking) and a private **Save** into your library (count never shown). You can do
  both.

Rules that keep it calm:
- **Products carry no like.** A product's two actions are **Save to pantry** (a private collection of
  saved products) and **Add to my list**.
- **The Like colour is reserved.** Rose-red lives only on the Like pill — never on ingredient/nutrition
  UI, so affection can never be mistaken for a health verdict.
- **Comments** keep a neutral ink up-vote ("agreement," drives the thread's Top sort) — the one place a
  vote survives.

This reversed an earlier locked decision — which is fine, but it's why the one-meaningful-colour rule
was carefully **reframed** (food = green/amber; social = rose) rather than broken. When a guardrail
bends, we re-write the canon so code and doc never disagree.

---

## 9 · The surfaces

Everything reuses the same tokens, type, and components.

| Surface | Route | What it is |
|---|---|---|
| The tool | `/` | The homepage *is* the tool. Paste a link (or ask, "kids cereals without junk"), hit Analyse, get a streamed per-ingredient breakdown with the big Statement count. Free, no sign-up to read. |
| Product | `/p/[slug]` | Permanent, shareable page per product; same ingredient list & neutral nutrition. Primary actions sit **under the title**: Save to pantry + Add to my list. Discussion + Explain card below. |
| List | `/list/[slug]` | A curated collection of products — the primary object. Public lists carry Like (public) + Save (private) + Share. |
| Profile | `/u/[handle]` | Pinterest-style, two tabs: **Pantry** (your saved products, owner-only & private, with search) and **Lists** (your own + saved, sorted Latest / Most-liked). "Create list" → modal → selection mode over the pantry. |
| Discover | `/discover` | The **Explore** surface: ranked public lists from people you don't follow (Following lives at `/feed`), blending likes + saves + recency + regional availability. Card grid at 1140px. |
| Share & auth | — | A share sheet (WhatsApp · Telegram · X · Facebook · Instagram + copy / save-image; native sheet on mobile). Auth is a calm modal (email · Google · continue-as-guest), portalled to `<body>` so it always centres. |

> The Pantry / profile / Explore work + nav line-icons currently live on the `profile-page` branch,
> close to landing on `main`.

---

## 10 · Decisions & the why

| Decision | Why |
|---|---|
| **No score, ever** | Scores judge; Baloo explains. A number would make one reading feel official and betray the calm, educational promise. The unbreakable rule. |
| **One meaningful colour (+ one social)** | Scarcity makes the single signal legible. Green/amber = classification on the food; rose-red = Like on the social layer. Kept in separate worlds so neither reads as the other. |
| **Ink, not black · flat, not glossy** | Pure black on cream is harsh and clinical — the mood Baloo rejects. Gradients & ambient shadow read app-store-generic; hairlines read like a considered field guide. |
| **Like (public) + Save (private)** | A save means "keep," a like means "endorse" — separating them lets popularity be visible without turning the private library into a public metric. |
| **Pantry for products, Lists for curation** | Products are saved loosely (a pantry); lists are the curated, shareable object built *from* the pantry — the Pinterest pins → boards model. |
| **The AI never looks like a person** | The Explain card is headed by the wordmark, not an avatar, and can't be voted on — facts stay visibly distinct from human opinion. |
| **Two typefaces, two jobs** | Playfair speaks so Baloo feels like a knowledgeable friend; Inter works so the app stays crisp. The contrast is the personality. |

---

## 11 · Do & Don't

**Do**
- Structure with 1px hairlines & whitespace first; add shadow only for hover-lift.
- Keep prose in the 640px reading column, 65–75ch.
- Headings & wordmark in Playfair; every control, label & value in Inter.
- Keep engagement controls neutral ink — ink border + ink/5% fill when active.
- Always give the Natural/Processed tag a text label.
- Use ink `#2D2417` for text; keep muted taupe ≥4.5:1.

**Don't**
- Add a score, rating, 0–100, or traffic-light verdict anywhere. The one unbreakable rule.
- Let green or amber appear outside the Natural/Processed tags, or the rose-red outside the Like pill.
- Use gradients — covers, tiles, buttons & text are all flat.
- Make it clinical: no chart-grid dashboards, warning banners, or health-record chrome.
- Use alarmist "toxic ingredient" language, red danger states, or scare imagery.
- Drop an ambient shadow on everything, or stack an uppercase eyebrow above every section.

---

## 12 · Where the canon lives

- **Strategic:** [`PRODUCT.md`](../PRODUCT.md) — register, users, purpose, personality, anti-references,
  design principles (incl. the score-free guardrail).
- **Visual:** [`DESIGN.md`](../DESIGN.md) — north star, tokens, named rules, components.
  [`.impeccable/design.json`](../.impeccable/design.json) is the machine-readable mirror.
- **How design work runs:** the `/impeccable` skill drives design/UI work and reads both files. To
  change the system, edit the root files — code and canon stay in lock-step.
- **Open for the designer:** bespoke **illustrations** for the nav concepts (currently clean
  line-icons); the saved-library naming ("Pantry" for now); a considered empty-state & onboarding pass.
  The system is stable — these are the next moves.
