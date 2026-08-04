# Mobile ↔ Web integration plan (Option 1 — endpoints, not a DB merge)

**Decision (Jitain, group thread):** do **not** merge the two Supabase backends. Keep the web
(`baloo-web`) and the mobile app (Igor's project) independent, and connect them through a small,
versioned **HTTP API on the web side** that the mobile backend calls. This shares Baloo's ingredient
"brain" and gives the app a web-scrape/search backstop for products its data sources (Open Food
Facts / Go-UPC / Vision) can't find — without making the two products interdependent.

If a full merge is ever wanted later, this endpoint layer is a stepping stone, not throwaway work.

> Scope note: everything here is additive and lives under `/api/v1/`. It must **never** touch or
> change the existing paste-flow routes (`/api/extract`, `/api/analyze`) or the web UI.

---

## The 5 locked decisions

1. **Service-to-service, not device-to-web.** The mobile app calls *Igor's* Supabase Edge Functions,
   which call the web API with a shared **service key** (`Authorization: Bearer <key>` or
   `x-api-key`). The device never holds a key; the two auth systems stay separate.
2. **Two endpoints, versioned under `/api/v1/`:**
   - `POST /api/v1/analyse-ingredients` — the brain. Mobile already has an ingredient list (from OFF
     / Vision) → gets back Baloo's per-ingredient analysis.
   - `POST /api/v1/find-product` — the backstop. A niche product not in OFF/Go-UPC → query or URL in,
     extracted product (+ optional analysis) out.
3. **Web owns the contract.** Published in [`API_CONTRACT_V1.md`](API_CONTRACT_V1.md); field names
   follow the web's shapes with a mapping note to Igor's `family / variant / ingredient_profiles`.
   Igor builds his client against it while he's away.
4. **What the web lends the app:** the shared analysis engine in `lib/analysis/` (one prompt, one
   schema) plus the rules worth adopting — label-order preservation, the neutral `role` microlabel,
   the Natural/Processed discipline, "code computes nutrition, model only phrases," the one-sentence
   `product_summary`. Captured for Igor in the "worth stealing" note (Thu).
5. **Cost control from day one.** Paid routes (Claude + Firecrawl). Per-key rate limit + reuse the
   catalog cache (`canonical_key`) so repeat products are ~free. Additive only.

---

## The week

| Day | Work | Deliverable |
|---|---|---|
| **Mon** | Contract + auth scaffold | Published `API_CONTRACT_V1.md`; `lib/apiAuth.ts` (service key, fail-closed); `GET /api/v1/ping` behind the key. **Send the contract to Igor.** |
| **Tue–Wed** | Endpoint 1 — `analyse-ingredients` | Ingredient list in → Baloo analysis out; reuses `analyseIngredients()` + catalog cache; 401/429 correct. |
| **Wed–Thu** | Endpoint 2 — `find-product` | URL or query in → extraction (+ optional analysis) out; reuses `scrapeAndExtract()`; friendly single-error on failure. |
| **Thu** | "Worth stealing" note for Igor | Short doc: what the web's analysis does that his engine could adopt. |
| **Fri** | Sandbox deploy + handoff | Endpoints behind the key on a preview URL; base URL + test key + `curl` sample to Igor; end-to-end mock request confirmed. Production untouched. |

---

## What's needed from Igor / Jitain (async — none of it blocks Monday)

- **Igor:** a couple of sample Open Food Facts payloads (so the contract matches his real data); a 👍
  on the service-key approach.
- **Jitain:** confirm these endpoints are the week's priority; confirm `find-product` may chain
  straight into analysis (one call) vs. return raw extraction (two calls).

## Definition of done (end of week)

Deployed, key-protected, rate-limited, cache-backed `/api/v1/` endpoints on a preview URL; a published
contract; the engine-improvement note; a mobile client stub. All additive; the web app and its
production behaviour untouched.
