# Baloo Web API — v1 (mobile integration contract)

Status: **DRAFT for Igor.** `ping` is built; `analyse-ingredients` and `find-product` are specced
here and built this week. Field shapes below are the web's real types (`lib/schema.ts`) — treat them
as the source of truth for the client.

- **Base URL (sandbox):** `https://<preview-deployment>.vercel.app` (shared Fri). Prod base TBD.
- **All routes:** `POST` unless noted, JSON in/out, `/api/v1/…`.
- **Runtime:** Node (uses `crypto`); each route caps at 60s (scrape + Claude).

## Auth

Service-to-service only — sent by **Igor's backend**, never the device. Either header:

```
Authorization: Bearer <BALOO_API_KEY>
# or
x-api-key: <BALOO_API_KEY>
```

Keys are configured web-side via the `BALOO_API_KEYS` env var (`label:secret` pairs, comma
separated). Fail-closed: if no keys are configured the API returns `503 api_not_configured`. A bad or
missing key returns `401 unauthorized`.

## Rate limits & errors

- Per-key sliding window (bucketed by the key's label). Over limit → `429` with a `Retry-After`
  header.
- **One friendly message per failure, never a raw error** (Baloo's contract). Error envelope:

```json
{ "error": "<machine_code>", "message": "<friendly sentence>" }
```

Codes: `unauthorized` (401), `api_not_configured` (503), `bad_request` (400), `rate_limited` (429),
`not_found` (404, find-product found nothing), `analysis_failed` (422), `upstream_unavailable` (503,
Claude/Firecrawl not configured or down).

---

## `GET /api/v1/ping` — built ✅

Health + key check. Returns the resolved key label so Igor can confirm his credential end-to-end.

```json
{ "ok": true, "service": "baloo-web", "version": "v1", "keyId": "mobile-dev", "time": "2026-08-03T…Z" }
```

---

## `POST /api/v1/analyse-ingredients` — the brain (Tue–Wed)

Mobile already has an ingredient list (from OFF / Vision). This runs Baloo's shared analysis engine
(`analyseIngredients`, one prompt + schema) and returns the per-ingredient breakdown. Known products
(deduped on `canonical_key`) return from the catalog cache with no model spend.

**Request**

```json
{
  "product": { "name": "Oat Drink Barista", "brand": "Oatly", "size": "1L", "retailer": "Ocado" },
  "ingredients": ["Water", "Oats 10%", "Rapeseed oil", "Acidity regulator (Dipotassium phosphate)"],
  "percentages": [{ "ingredient": "Oats", "percentage": "10%" }],
  "nutrition": { "…optional pass-through, same shape as the response…" }
}
```

- `product.name` + `ingredients[]` are required; everything else optional.
- `retailer`/`brand`/`size` improve the `canonical_key` dedupe (barcode, else brand+name+size).

**Response** (`200`)

```json
{
  "product_name": "Oat Drink Barista",
  "product_summary": "One calm, neutral sentence about the formulation as a whole.",
  "ingredients": [
    {
      "name": "Rapeseed oil",
      "tag": "Processed",                      // "Natural" | "Processed" — the ONLY meaningful colour
      "role": "Fat / emulsion",                // 2–4 word neutral microlabel, never a judgment
      "what_it_is": "Plain-language description of the ingredient itself.",
      "why_its_here": "Why it is in THIS product, tied to the label.",
      "percentage": "10%",                     // or null
      "percentage_note": "Whether that amount is meaningful or cosmetic."  // or null
    }
  ],
  "nutrition": {
    "serving_size": "200 ml",                  // or null
    "per": "100g",                             // "100g" | "serving" | "both"
    "nutrients": [
      { "name": "Energy", "per_100g": "45", "per_serving": "90", "unit": "kcal" }
    ]
  },
  "cache": "hit",                              // "hit" | "miss"
  "canonical_key": "oatly|oat-drink-barista|1l"
}
```

Guardrails baked in: **no score, no rating, no traffic-light, no good/bad verdict** — ever.
Ingredient order = label order, never re-sorted. Nutrition numbers are copied/computed in code; the
model only phrases them.

---

## `POST /api/v1/find-product` — the scrape/search backstop (Wed–Thu)

For niche products the app's sources can't find. Give a direct `url` (reliable) or a `query`
(best-effort search — the harder half; may need a search step on top of Firecrawl). Set
`analyse: true` (default) to chain straight into analysis and get the full result in one call.

**Request** (one of `url` | `query` required)

```json
{ "url": "https://www.ocado.com/products/oatly-…", "analyse": true }
```
```json
{ "query": "Oatly Barista 1L", "analyse": false }
```

**Response — `analyse: true`** → identical shape to `analyse-ingredients` above, plus `"source_url"`.

**Response — `analyse: false`** → raw extraction only:

```json
{
  "product_name": "…",
  "retailer": "Ocado",
  "source_url": "https://…",
  "ingredients_list": ["Water", "Oats 10%", "…"],
  "percentages": [{ "ingredient": "Oats", "percentage": "10%" }],
  "nutrition": { "…same nutrition shape…" }
}
```

Found nothing usable → `404 not_found` with the friendly message
("We couldn't read that page. Try a direct product link…").

---

## Field mapping — web ↔ Igor's schema

So Igor can map responses straight into his tables:

| Web (this API) | Igor's schema |
|---|---|
| `ingredients[].what_it_is` | `ingredients.general_explanation` (product-independent cache) |
| `ingredients[].why_its_here` | `ingredient_profile_items.product_context` |
| `ingredients[].role` | *(new microlabel — his `significance_note` is the closest slot)* |
| `ingredients[].tag` (Natural/Processed) | `ingredients.processing_tag` |
| `ingredients[].percentage` | `ingredient_profile_items.percent` |
| `product_summary` | *(per-variant; no exact slot yet)* |
| `nutrition.*` | `nutritional_profiles.*` |
| `canonical_key` | his identity: barcode, else brand+name+size |

## Versioning

`/api/v1/` is frozen once Igor builds against it. Breaking changes go to `/api/v2/`. Additive fields
(new optional response keys) are allowed within v1. Changelog appended here.
