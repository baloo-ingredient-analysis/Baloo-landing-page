# Baloo Web API — handoff (for Igor)

The web-side integration API is live on a Vercel **preview** deployment. Full spec:
[`API_CONTRACT_V1.md`](API_CONTRACT_V1.md). This is the 60-second "plug in and try it" version.

## What you need

- **Base URL:** `https://baloo-web.vercel.app` (stable production alias; `baloo.life` will work too once the domain is pointed here)
- **API key:** sent to you privately (never commit it). Send it on every request as either header:
  - `Authorization: Bearer <KEY>`
  - `x-api-key: <KEY>`

## Try it (copy-paste, replace `BASE` and `KEY`)

```bash
BASE="https://baloo-web.vercel.app"
KEY="<your key>"

# 1) health + key check  →  { ok, service, version, keyId, time }
curl -s "$BASE/api/v1/ping" -H "Authorization: Bearer $KEY"

# 2) analyse an ingredient list you already have (from OFF/Vision)
curl -s -X POST "$BASE/api/v1/analyse-ingredients" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{
    "product": { "name": "Oat Drink Barista", "brand": "Oatly", "barcode": "7394376616457" },
    "ingredients": ["Water", "Oats 10%", "Rapeseed oil", "Salt"],
    "percentages": [{ "ingredient": "Oats", "percentage": "10%" }]
  }'

# 3) find a niche product by URL (or swap "url" for "query": "Oatly Barista 1L")
curl -s -X POST "$BASE/api/v1/find-product" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{ "url": "https://www.ocado.com/products/...", "analyse": true }'
```

## Good to know

- **Send `barcode` whenever you have it** — it's the strongest identity, so your barcode scan and the
  web's URL paste converge on one catalog row. A known product returns instantly with **no model spend**
  (`"cache": "hit"`); a new one is analysed (~40s) and then cached for next time.
- **Same brain, same voice.** `analyse-ingredients` runs the exact engine the website uses — no scores,
  no verdicts, label order preserved, nutrition never invented. See [`ENGINE_NOTES_FOR_IGOR.md`](ENGINE_NOTES_FOR_IGOR.md).
- **Errors are always** `{ "error": "<code>", "message": "<friendly>" }`: `401` bad/missing key,
  `400` bad input, `404` find-product found nothing, `429` rate limited, `503` service off/unconfigured.
- **`find-product` `query`** is best-effort (web search → top results); a direct `url` is reliable.
- This is a **preview** deployment — production is untouched. Ping me (Miquel) with the base URL + key.
