# Baloo recognition API (partner)

Hand this file to the other developer. They do not need the Flutter app or the rest of the repo.

The API is three HTTPS POST endpoints. Typical flow:

1. Photo of the pack → product identity (`read-label`)
2. Barcode or brand + name → catalog match and ingredient list (`find-ingredients`)
3. `variant_id` or a list of names → plain-language explanations (`explain-ingredients`)

Call these from **your backend**. Do not put the secret key in a website or mobile client.

---

## Base URL

```
https://rahjnurtpwygtaayzfgi.supabase.co/functions/v1
```

| Endpoint | Purpose |
|---|---|
| `POST /read-label` | Read a product photo (front or ingredient label) |
| `POST /find-ingredients` | Find the product and its ingredient list |
| `POST /explain-ingredients` | Explain ingredients |

All requests: `Content-Type: application/json`.

---

## Auth

Send both headers on every request:

| Header | What it is |
|---|---|
| `apikey` | Supabase anon key. Required by the gateway. This value is public. |
| `x-recognition-key` | Partner key issued by Baloo for your product. This is the real lock. |

`x-api-key` is accepted as an alias for `x-recognition-key`.

Ask Baloo for two values (private channel, not in this file):

1. The anon key
2. Your product key, starts with `baloo_`. Each product has its own.

Wrong or missing `x-recognition-key` → `401` `{ "error": "Unauthorized" }`.  
If Baloo has not issued any keys yet → `503` `{ "error": "Partner API is not configured" }`.

**Do not** use a Baloo user JWT. **Do not** use the Supabase `service_role` key. **Do not** put `x-recognition-key` in frontend JavaScript. Keep it on your server.

---

## 1. `POST /read-label`

Photo URL → brand, name, size, barcode, and (in ingredients mode) the label list.

### Request

```json
{
  "photo_url": "https://example.com/pack.jpg",
  "mode": "front",
  "locale": "pl",
  "prior": {
    "brand": "Hortex",
    "productName": "Sok pomarańczowy",
    "confidence": "medium"
  }
}
```

| Field | Required | Notes |
|---|---|---|
| `photo_url` | yes | Public HTTPS image URL that OpenAI Vision can fetch |
| `mode` | no | `front` (default) or `ingredients` |
| `locale` | no | Hint for the label language, e.g. `pl`, `en` |
| `prior` | no | Earlier identity if you already know brand/name (refine) |

`prior` fields: `brand`, `productName`, `category`, `sizeValue`, `sizeUnit`, `confidence` (`high` \| `medium` \| `low`).

### Response (`mode: "front"`)

```json
{
  "mode": "front",
  "barcode": "5901234123457",
  "identity": {
    "brand": "Hortex",
    "product_name": "Sok pomarańczowy",
    "category": "juice",
    "size_value": 1,
    "size_unit": "l",
    "confidence": "high",
    "region": null
  },
  "front": { }
}
```

`front` is the raw Vision object (brand, product_name, size, barcode_digits, claims, confidence, …). It can be `null` if the photo was unreadable.

### Response (`mode: "ingredients"`)

Same envelope, plus `label` instead of `front`. `label` includes `ingredients` (`[{ "name", "rank", "percent" }]`), `ingredients_text`, allergens, nutrition, `legible`, and `country` (copied into `identity.region`).

---

## 2. `POST /find-ingredients`

Identity or barcode → catalog match.

Send **one** of:

- `barcode`
- `brand` **and** `product_name`
- `selected_variant_id` (after a `disambiguation` response)

You can send barcode together with brand/name. Optional: `category`, `size_value`, `size_unit`, `locale`, `region`, `confidence`.

```json
{
  "barcode": "5901234123457",
  "brand": "Hortex",
  "product_name": "Sok pomarańczowy",
  "locale": "pl"
}
```

### `status: "found"`

Use `variant_id` for explanations.

```json
{
  "status": "found",
  "variant_id": "2f1c…",
  "display_name": "Sok pomarańczowy 1l",
  "brand": "Hortex",
  "category": "juice",
  "size_value": 1,
  "size_unit": "l"
}
```

### `status: "disambiguation"`

Show `candidates` to the user, then call again with `selected_variant_id` (a catalog UUID or an `off:…` id from the list).

```json
{
  "status": "disambiguation",
  "display_name": "Sok pomarańczowy",
  "brand": "Hortex",
  "candidates": [
    {
      "variant_id": "2f1c…",
      "display_name": "Sok pomarańczowy 1l",
      "brand": "Hortex",
      "confidence": 0.91,
      "size_value": 1,
      "size_unit": "l",
      "has_ingredients": true
    }
  ]
}
```

### `status: "not_found"`

```json
{
  "status": "not_found",
  "fallback": "photograph_ingredients",
  "message": "We couldn't find this barcode with a usable ingredient list.",
  "brand": "Hortex",
  "display_name": "Sok pomarańczowy"
}
```

Missing input → `400` `{ "error": "barcode, selected_variant_id, or brand + product_name is required" }`.

---

## 3. `POST /explain-ingredients`

### A. After a catalog match (preferred)

```json
{ "variant_id": "2f1c…", "skip_explanations": false }
```

```json
{
  "variant_id": "2f1c…",
  "display_name": "Sok pomarańczowy 1l",
  "brand": "Hortex",
  "category": "juice",
  "profile_id": "…",
  "ingredients": [
    {
      "id": "…",
      "profile_item_id": "…",
      "canonical_name": "orange juice",
      "rank": 1,
      "percent": null,
      "processing_tag": "natural",
      "general_explanation": "…",
      "product_context": "…",
      "significance_note": "…",
      "role_tags": ["base"]
    }
  ]
}
```

`processing_tag` is `natural`, `processed`, or `artificial`.

Unknown `variant_id` → `404`.

### B. Names only (no catalog row)

```json
{ "ingredients": ["sugar", "salt", "yellow 5"] }
```

```json
{
  "ingredients": [
    {
      "canonical_name": "sugar",
      "general_explanation": "…",
      "processing_tag": "processed"
    }
  ]
}
```

This path does **not** return product-specific context.

### C. One ingredient

```json
{
  "mode": "general",
  "canonical_name": "sugar"
}
```

`mode`: `general` | `context` | `both`. Context needs `profile_item_id` and usually `variant_id`.

---

## Errors

| Status | Body | Meaning |
|---|---|---|
| 400 | `{ "error": "…" }` | Bad or missing JSON fields |
| 401 | `{ "error": "Unauthorized" }` | Missing/wrong `x-recognition-key` |
| 404 | `{ "error": "…" }` | Product / profile not found |
| 405 | `{ "error": "Method not allowed" }` | Not POST |
| 500 | `{ "error": "Something went wrong. Please try again." }` | Server failure |
| 503 | `{ "error": "Partner API is not configured" }` | No partner keys issued yet — ask Baloo |

CORS allows browser calls, but the product key must stay on a server. Proxy from your API.

---

## Example (server-side)

```bash
BASE='https://rahjnurtpwygtaayzfgi.supabase.co/functions/v1'
ANON='SUPABASE_ANON_KEY'
SECRET='baloo_yourproduct_…'

curl -sS -X POST "$BASE/read-label" \
  -H "apikey: $ANON" \
  -H "x-recognition-key: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"photo_url":"https://example.com/pack.jpg","mode":"front","locale":"pl"}'

curl -sS -X POST "$BASE/find-ingredients" \
  -H "apikey: $ANON" \
  -H "x-recognition-key: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"barcode":"5901234123457","locale":"pl"}'

curl -sS -X POST "$BASE/explain-ingredients" \
  -H "apikey: $ANON" \
  -H "x-recognition-key: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"variant_id":"VARIANT_UUID"}'
```

---

## Notes for integration

- `photo_url` must be reachable from the internet. A signed URL that expires in a few minutes is fine if Vision can fetch it during the request.
- `read-label` costs a Vision call. `explain-ingredients` may call Claude on cache miss. Cache hits are cheap.
- `find-ingredients` may write a confident match into the shared Baloo catalog. That is intended.
- The Flutter app still uses different URLs (`recognize-product`, `resolve-ingredients`, `explain-ingredient`) and user JWTs. Do not mix the two auth schemes.
