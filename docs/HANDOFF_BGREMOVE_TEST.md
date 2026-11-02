# Handoff — verify Higgsfield background removal so the hybrid compositor runs end-to-end

For the session that has the **Higgsfield API key**. Everything in the share-card compositor is built,
tested and validated **except one call I couldn't verify without the key**: the background-removal REST
request. Please confirm/fix it and run it once end-to-end, then clear the flags.

Branch `fix/instagram-share-desktop-v9vkps` (compositor landed in commit `e848554`).

## What's already done (no need to touch)
- `lib/sharecard/composite.ts` (sharp) — scales each **real** cutout, places it on the shipped backdrop
  (`lib/sharecard/backdrops/cream-marble.jpg`) with contact shadows, layouts for 1–4 products. Validated
  locally against real cutouts **and** through the actual feed (4:5) and unfurl (1.91:1) cards — frames
  correctly, labels fully preserved. Unit-tested.
- `generate.ts` — `renderWithCompositor` is the PRIMARY hero path; generative is off unless
  `HERO_GENERATIVE=1`. A failed render → null → the always-accurate designed card (nothing breaks).
- Detector widened so clean flat fronts also composite.

## The one unknown — `lib/sharecard/bgRemove.ts`
Best-guess contract (mirrors the working calls in `generate.ts`):
- `POST https://api.higgsfield.ai/image/remove-background` (constant `HF_REMOVE_PATH`)
- Header `Authorization: Key <KEY_ID>:<KEY_SECRET>`
- Body `{ "image_url": "<packshot url>" }`
- Result read from an inline `image.url` / `result.url` / `url`, else an async `request_id`/`status_url`
  polled until `status:"completed"` (`image.url` / `images[0].url` / `results[0].url`).

### Step 1 — confirm the endpoint
```bash
# HIGGSFIELD_API_KEY="KEY_ID:KEY_SECRET"
curl -sS -X POST https://api.higgsfield.ai/image/remove-background \
  -H "Authorization: Key $HIGGSFIELD_API_KEY" -H "Content-Type: application/json" \
  -d '{"image_url":"https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.879.400.jpg"}' -i
```
If it 404s, find the real path (Higgsfield API docs, or how the `remove_background` MCP tool calls it) and
update `HF_REMOVE_PATH`, the request body, and/or the result-key extraction in `bgRemove.ts` to match.

### Step 2 — run it end-to-end
With `HIGGSFIELD_API_KEY`, `ANTHROPIC_API_KEY` (classifier), `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_SUPABASE_URL` set and a public `share-heroes` Storage bucket:
```bash
npm run db:heroes -- --lists --limit 2
```
Open `/api/share/list/<slug>` → expect the composited hero (real products on cream marble with shadows).
The cutout is cached at `share-heroes/cutout/<hash>.png`, so re-runs are fast.

Notes: leave `HERO_GENERATIVE` unset (compositor is default); if bg-removal returns null the card safely
falls back to the designed no-photo card while you iterate.

## When it works
Remove the ⚠️ "needs live-key check" lines in [`SESSION_CONTEXT.md`](SESSION_CONTEXT.md) and
[`SHARE_CARDS.md`](SHARE_CARDS.md), note it confirmed, and commit.
