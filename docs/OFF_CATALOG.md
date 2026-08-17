# Open Food Facts catalog + search-first web

Status: **building on `feat/off-catalog`.** Why: scraping retailer sites is a dead end (tested — Tesco
and Kroger hard-block us; even reachable sites like Ocado/Target never publish the barcode; Mercadona
is postcode-gated; Lidl/Aldi don't publish ingredient pages, their data is already on OFF). So the web
stops scraping and instead **searches a catalog it fills from Open Food Facts** (and, later, the mobile
app's scans). The user searches by name ("hazelnut cream" → Nutella, Nocilla); a hit is served from the
catalog instantly; a miss is looked up in OFF, analysed once, and cached.

The **search engine already exists** (SS1–SS4: pgvector + hybrid semantic/keyword `searchAll`,
`/api/search`). The new work is the **product source**: Open Food Facts.

## Data-source model (decided with the team)
- **Ingredient truth = Open Food Facts / the shared engine**, never retailer pages (which block us,
  lack barcodes, and can be wrong anyway).
- **Barcode comes from the physical product** (the app's scan) or is already known — never from a link.
- A pasted link is at most a way to grab **name + image**, not ingredients or a barcode.
- "Available at" store links are **derived** (own-brand → its store; national brand → the main chains;
  OFF's `stores` tags), not scraped. Affiliate is de-prioritised (low value + trust cost).

## Build orders

### OFF1 — OFF client + mapper (pure, tested) — ✅ in progress
`lib/openfoodfacts.ts`: `getOffProductByBarcode(code)` + `searchOffProducts(query, limit)` over OFF's
public API (no key; descriptive User-Agent; optional-infra — any failure returns null/[]). Pure mappers
`mapOffProduct` / `mapOffNutrition` / `parseOffIngredients` normalise an OFF product into our internal
shape (barcode, name, brand, quantity, ordered ingredients + %, `Nutrition`, image, stores, countries).
Unit-tested against a fixture; verified live against a real barcode.

### OFF2 — Import an OFF product into the catalog
`importOffProduct(barcodeOrQuery)`: map → build the analyser input from OFF's ingredient list → run
`analyseIngredients` (reuses the existing engine, skipping scrape/extract since OFF is already
structured) → `ingestAnalysis` (canonical_key = `barcode:<code>`). Nutrition passed straight through.
Records OFF `stores` as offers where recognised. Never re-analyses a known barcode (catalog short-circuit).

### OFF3 — Wire OFF into search + a seed script
- On a catalog **miss**, optionally do a live OFF **name** lookup → import the top confident match →
  return it (so coverage isn't limited to what's pre-seeded).
- `scripts/seed-off.ts` (`npm run db:seed-off`): bulk-import a curated list of popular UK/ES barcodes so
  search feels full on day one. Dry-run by default; respects OFF rate limits.

### OFF4 — Search as the front door + verify + docs
Make search the primary homepage action (the dual-intent box already exists); the paste-link path
becomes the secondary "add by name/image". Verify end to end; update ARCHITECTURE.md + CHANGELOG.md.

## Notes
- **Licensing:** OFF is ODbL (share-alike). Fine for the consumer web with attribution; **legal sign-off
  before any of it feeds a paid/B2B product** (Jitain — same gate as the old P6 note).
- **Bulk scale later:** for large seeding, use OFF's downloadable data dumps, not the API.
- Everything stays optional-infra: no OFF reachability → search just serves the existing catalog.
