# Ingredient engine — what the web version does that might be worth adopting

_For Igor. Context: Jitain asked whether anything in the website's ingredient analysis could improve
the app's engine (which stays the primary one). This is that list — specific, practical techniques
from `baloo-web`, each mapped to a slot in your schema. Not a rewrite; a "steal the good bits" note._

Everything here is also exposed live as `POST /api/v1/analyse-ingredients` (see
[`API_CONTRACT_V1.md`](API_CONTRACT_V1.md)) — so you can either **call it** or **mirror the ideas** in
your own GPT-4o engine. Either way the two should produce the same *shape* and the same *voice*.

---

## Already aligned (good — let's keep these identical)

These you already do; worth confirming they match exactly so app and web never diverge:

- **Two-beat per ingredient.** Web splits `what_it_is` (the ingredient in general, product-independent)
  from `why_its_here` (its role in *this* product). Your `ingredients.general_explanation` ↔ `what_it_is`,
  `ingredient_profile_items.product_context` ↔ `why_its_here`. Same idea — keep the boundary strict.
- **Product-independent definition cache.** `what_it_is` is cached once per ingredient (by normalised
  name) and reused across every product; only the per-product context is stored per profile. Your
  `ingredients` table vs `ingredient_profile_items` is the same invariant. Saves tokens **and** keeps
  a given ingredient's definition consistent everywhere.
- **Label order is absolute.** Ingredients are never re-sorted — rank = label order, most-to-least.
  You have `rank`; just never let the model reorder.
- **Natural/Processed tag.** Web's `tag` (`Natural` | `Processed`) ↔ your `processing_tag`. See the
  colour rule below.

---

## Worth adopting (new-ish ideas from the web side)

### 1. A neutral `role` microlabel (2–4 words)
Every ingredient gets a tiny functional label — **"Base", "Sweetener", "Acidity regulator",
"Fortification", "Thickener / stabiliser"** — never a judgment. It's what lets a collapsed list row
read at a glance before you tap in. Your closest slot is `significance_note`, but `role` is shorter and
more structured; consider a dedicated field. (In the live Nutella test: Sugar → "Sweetener", Palm Oil
→ "Oil / fat", Hazelnuts → "Flavour / base".)

### 2. One-sentence `product_summary`
A single calm sentence about the **whole** formulation, shown at the top of the product view. From the
live run: _"Nutella is built on a sugar and palm oil base, with three characterising flavour ingredients
— hazelnuts, skimmed milk powder, and fat-reduced cocoa — making up just under 30%…"_. No per-variant
slot for this in your schema yet — worth one (it reads really well as a header).

### 3. `percentage_note`, not just `percentage`
Capture the label % (you have `percent`) **and** a neutral note on whether that amount is meaningful or
mainly cosmetic — _"At 10%, oats are the defining ingredient"_ vs _"present in a small amount, mainly for
flavour"_. This is exactly the "matcha cookies don't have enough matcha to matter" idea Jitain wants,
but framed neutrally at the ingredient level. Cheap to add, high signal.

### 4. Nutrition: **code computes, the model only phrases** ⚠️ the important one
The model is **never** allowed to do arithmetic. Numbers are captured verbatim as printed (never
converted, never invented), and all maths (%RI, per-serving, highlights) happens in code; the model only
writes short, neutral sentences *around* numbers that code computed. This is the single biggest
trust/accuracy safeguard — it makes hallucinated nutrition numbers structurally impossible. If your
GPT-4o path currently lets the model state or compute any nutrition number, this is the change I'd make
first.

### 5. Structured output + a token-limit gotcha ⚠️
Web uses schema-validated generation (the model returns a validated object, not free text) — worth doing
with GPT-4o structured outputs / JSON schema so the shape can't drift. **And a hard-won bug:** the
default output-token cap (4096 on the AI SDK) silently **truncates long ingredient lists** — the object
never validates and the whole analysis is lost with no error. Web sets it to **16000**. If you ever see
long-label products fail silently, check your `max_tokens` first.

### 6. Shared voice (verbatim from the web prompt)
So the app's *ingredient layer* sounds like the web even as you add the personalized layer on top:

> _"You are a knowledgeable, calm nutritionist. Education before persuasion. Never alarmist. Never tell
> the user what to buy or avoid. Explain what ingredients are and why they are used. Context over
> judgment."_

### 7. One friendly failure, never a raw error
Every failure path returns a single calm message ("We couldn't read that product. Try a direct link…"),
never a stack trace or model error. Small thing, big trust difference.

---

## The one hard line (both engines, forever)
**No score, no rating, no traffic-light, no good/bad verdict — anywhere.** Natural/Processed is the only
tag that carries colour/meaning. Ingredients are an encyclopedia; the personalized "for your goals" layer
is a *separate* layer on the app, and even it is framed "for you", never "this product is bad."

---

## Field mapping cheat-sheet

| Web field | Your schema |
|---|---|
| `what_it_is` | `ingredients.general_explanation` |
| `why_its_here` | `ingredient_profile_items.product_context` |
| `role` | *(new — closest today is `significance_note`)* |
| `tag` (Natural/Processed) | `ingredients.processing_tag` |
| `percentage` | `ingredient_profile_items.percent` |
| `percentage_note` | *(new)* |
| `product_summary` | *(new — per variant)* |
| `nutrition.*` | `nutritional_profiles.*` |

Happy to walk through any of these on a call when you're back.
