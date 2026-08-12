# Geo-ranking — algorithm + build orders

Status: **draft for team sign-off** (Jitain's notes, 2026-08-10). Turns his geolocation/ranking
comments into a concrete algorithm grounded in the current schema, then into ordered build steps.
Pure-math layers stay framework-agnostic (`lib/region.ts`, `lib/retailers.ts`) so the mobile app
reuses them.

## Principle (from Jitain)
> "Geo makes sense to prioritize by default all the lists that contain x% of products that are
> available to buy where the user is … but we cannot put a hard rule like that. Interest will drive
> ranking, meaning people have to get creative for niche categories" (his Koro example — a German
> shop people elsewhere still seek out).

So: **interest drives ranking; geo is a soft nudge; niche non-local lists are never hidden.**

## What already exists (Order L7 — the foundation to evolve)
- [`lib/config.ts`](../lib/config.ts) — `SUPPORTED_RETAILERS`, each tagged `region: "US" | "UK"`.
- [`lib/region.ts`](../lib/region.ts) — `computeAvailability()` → `pct` = fraction of a list's
  products buyable in a region (a product counts if ANY of its retailers serves it);
  `availabilityLabel()` → neutral tone (`full/most/some/none`).
- [`lib/db/queries/lists.ts`](../lib/db/queries/lists.ts) — `withRegionAvailability()` annotates lists
  and **sorts purely by `pct` desc**, incoming order as tiebreak.

**The gap:** that pure-`pct` sort is effectively the hard rule Jitain rejected — availability first,
interest only as a tiebreak. This plan keeps the plumbing and inverts the emphasis.

## The algorithm

### Score
For a list `L` and the user's country `C`:

```
score(L, C) = base(L) × (1 + λ × geo(L, C))
```

- **`base(L)`** — the existing ranking signal: engagement + recency for feed/Explore; text+semantic
  relevance (the RRF score we already compute) for search. This IS the ranking.
- **`geo(L, C) ∈ [0,1]`** — weighted local buyability (below).
- **`λ`** — nudge strength. Multiplicative on purpose: `geo = 0` gives multiplier `1`, so a very
  popular non-local list still ranks on merit — geo can only LIFT a locally-buyable list, never bury
  a good one. (Additive weighting would let a dull local list leapfrog a brilliant non-local one —
  the niche-killing behaviour we're avoiding.)

### `geo(L, C)` — two-tier weighted availability
Generalizes `computeAvailability` from binary to two tiers ("if Ocado delivers to Spain we could
figure that in, but less"):

```
per-product availability in C = max over the product's retailers of:
    1.0    if the retailer is BASED in C          (Ocado for a UK user)
    w_del  if the retailer only DELIVERS to C      (Koro shipping to a UK user)
    0      otherwise

geo(L, C) = mean(per-product availability) over the list's products
```

Empty lists / products with no recognized retailer → `0` (never over-promise) — under the multiplier
that just means "no boost," not "hidden."

### Feed vs search (answers Jitain's "feed or search?")
Same formula, different `λ`:

| Surface | `base` | `λ` (default) | Effect |
|---|---|---|---|
| **Feed / Explore / browse** | engagement + recency | **λ_feed = 0.6** | Geo is a real contributor to the default sort |
| **Search** | text + semantic relevance | **λ_search = 0.2** | Geo is a light tiebreaker; the query wins |

A search for "Koro" surfaces the Koro list even for a UK user; an idle Explore scroll leans toward
what they can actually buy.

### Country model
Today `Region = "US" | "UK"`. Spain/Germany need real countries:
- Retailers become `{ countries: string[]; deliversTo?: string[] }` in ISO-3166 alpha-2 (`US`, `GB`,
  `ES`, `DE`), with a `"UK"→"GB"` shim so existing callers don't break.
- User `C` = **Vercel geolocation** (`req.geo.country`) — already a country code, already used in
  [`lib/stats.ts`](../lib/stats.ts). No new dependency.
- **Koro** (home `DE`, `deliversTo` EU) is the first cross-border retailer, so the delivery tier has
  a live example to test.
- `availabilityLabel` tones stay, but become **UI badge only** ("Mostly available where you shop"),
  decoupled from ranking. That's where Jitain's "x% of products" lives — display tiers, not a gate.

### Edge cases (all resolve to "rank on interest, never drop")
- **Unknown / no geolocation** (VPN, signed-out, blocked) → geo term neutralized, multiplier `1`,
  pure interest/relevance globally.
- **Country we don't cover yet** (a Spanish user before EU retailers exist) → almost everything geo
  `0`, behaves like no-geo, lights up as retailers are added.
- **Empty list / unknown retailers** → geo `0`, ranks on interest, still shown.

### Tunable defaults (one place, dial with Luna's testing)
`w_del = 0.35` · `λ_feed = 0.6` · `λ_search = 0.2` · geo neutral when country unknown · display
tiers unchanged.

## Open questions for Jitain (the 3 real judgment calls)
1. **Feed strong / search light** — confirm this split matches intent.
2. **`w_del`** — is `0.35` right, or should cross-border delivery count more/less?
3. **Never hard-filter** — proposing we NEVER hide non-local lists, only nudge (his niche argument to
   its conclusion). Explicit yes?

These change tuning, not structure — GR1–GR2 can ship behind the defaults before he answers; GR3+
apply his final numbers.

---

## Build orders

Small, additive layers over the L7 foundation — no query rewrites. Commit-per-order.

### GR1 — Country + delivery model (pure, no behaviour change yet)
- `lib/retailers.ts`: migrate retailers to `{ countries: string[]; deliversTo?: string[] }` (ISO
  alpha-2). Keep `Region`/`retailerRegion` working via a `"UK"→"GB"` shim so L7 callers are untouched.
  Add helpers `retailerCountries(name)` and `retailerServes(name, country) → 1 | w_del | 0`.
- `lib/config.ts`: update `SUPPORTED_RETAILERS` with `countries`; add **Koro** (`DE` home, EU
  `deliversTo`) as the cross-border example.
- Tests: `lib/retailers.test.ts` — home match = 1, delivery-only = `w_del`, none = 0, shim maps UK↔GB.
- **Commit:** `GR1: retailer country + delivers-to model (ISO codes, Koro, UK→GB shim)`.

### GR2 — Weighted geo score (pure math)
- `lib/region.ts`: add `weightedAvailability(perProductRetailers, country, w_del) → geo ∈ [0,1]`
  (two-tier max per product, mean across products). Leave `computeAvailability`/`availabilityLabel`
  in place — the badge still uses `pct`.
- `lib/config.ts`: add `GEO_WEIGHTS = { w_del: 0.35, lambdaFeed: 0.6, lambdaSearch: 0.2 }`.
- Tests: `lib/region.test.ts` — delivery tier, empty list = 0, all-local = 1, mixed.
- **Commit:** `GR2: weighted two-tier geo availability + tunable weights`.

### GR3 — Blended re-rank for feed / Explore
- `lib/db/queries/lists.ts`: replace `withRegionAvailability`'s pure-`pct` sort with the blended
  re-rank — derive `base` from the incoming (already engagement-ordered) rank position, multiply by
  `(1 + lambdaFeed × geo)`, re-sort stably. Still a post-fetch annotate layer; still never drops a
  list. Keep the `availability` badge annotation (from `pct`) for the UI.
- Wire the user's country from Vercel geo where the Explore/feed queries are called (replace/extend
  the current `region` param; fall back to neutral when absent).
- Tests: a popular non-local list stays on page 1; a local list is lifted above an equally-popular
  non-local one; unknown country = unchanged order.
- **Commit:** `GR3: blend geo into feed/Explore ranking (interest-first, geo as nudge)`.

### GR4 — Light geo tiebreak in search
- Apply the same multiplier with `lambdaSearch` as a post-step in `searchAll` (products and lists),
  after the RRF fusion — so relevance dominates and geo only breaks near-ties.
- Thread the query embedding path already there; add country from geo.
- Tests: a relevance-strong non-local hit still ranks first; geo only reorders near-equal relevance.
- **Commit:** `GR4: geo as a light tiebreaker in search`.

### GR5 — Verify + document
- Seed lists across `US` / `GB` / `DE` (incl. a Koro/EU delivery list); verify in the browser as a
  UK-geo user: local lists lifted, a very-popular US-only list still on page 1, "Koro" search still
  finds it. Confirm signed-out / unknown-geo = global order.
- Update `docs/ARCHITECTURE.md` (ranking section) + `docs/CHANGELOG.md`; flip this doc's status to
  "implemented" and fold in Jitain's final answers to the 3 questions.
- **Commit:** `GR5: verify geo-ranking end to end + docs`.

## Notes
- All geo math is optional-infra-friendly: no geolocation → neutral, no DB → no lists to rank. Same
  degrade-to-no-op rule as the rest of the stack.
- This is also the "plug these comments into your AI for a basic algorithm" step Jitain suggested —
  usable as-is for his reaction.
