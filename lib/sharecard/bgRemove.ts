// Background removal for the hybrid compositor — turns a product packshot into a transparent-PNG cutout,
// so the compositor places the REAL product on a generated backdrop (never redrawing packaging).
//
// Provider: remove.bg (a dedicated background-removal API). A single synchronous POST with the packshot
// URL returns the transparent PNG directly — a TRUE cutout, so the real packaging is preserved. (Higgsfield
// was the first guess, but its only usable REST path is generative — it would redraw the pack, against the
// compositor's whole point — and it has no plain background-removal endpoint. So a dedicated remover is used
// here; Higgsfield stays only for the optional generative A/B path in generate.ts.)
//
// Optional-infra: null without REMOVE_BG_API_KEY; best-effort: null on any failure, so the compositor simply
// drops that product (and the ladder falls back to the designed card if none remain).
//
// Cutouts are cached in Supabase Storage keyed by a stable id (the product id): a product's cutout is
// identical wherever it appears, so we remove it once per product, not once per card/list.
//
// ⚠️ NEEDS A LIVE KEY TO VERIFY: set REMOVE_BG_API_KEY (remove.bg — the free tier covers testing) and run
// the compositor once end-to-end. Everything degrades safely until then (no cutout → designed card).

const REMOVEBG_URL = "https://api.remove.bg/v1.0/removebg";

const CUTOUT_BUCKET = process.env.HERO_BUCKET || "share-heroes";

/** Remove the background from a packshot URL → transparent PNG bytes. Null on any failure / no key. */
export async function removeBackground(imageUrl: string): Promise<ArrayBuffer | null> {
  const key = process.env.REMOVE_BG_API_KEY;
  if (!key || !imageUrl) return null;
  try {
    const res = await fetch(REMOVEBG_URL, {
      method: "POST",
      headers: { "X-Api-Key": key, "Content-Type": "application/json", Accept: "image/png" },
      // type:"product" tunes the model for packaging; format:"png" keeps transparency; size:"auto" = full res.
      body: JSON.stringify({ image_url: imageUrl, size: "auto", format: "png", type: "product" }),
    });
    if (!res.ok) {
      // remove.bg returns a JSON { errors:[{title}] } on failure — surface it, then degrade.
      console.error("remove.bg failed:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const buf = await res.arrayBuffer();
    return buf.byteLength > 0 ? buf : null;
  } catch (err) {
    console.error("remove.bg error:", err);
    return null;
  }
}

// ── Supabase cutout cache (remove once per product, reuse everywhere) ──────────────────────────────────

function supa(): { base: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { base: url.replace(/\/$/, ""), key };
}

/** A cached cutout's bytes, if we've already removed this product's background. */
async function getCachedCutout(cacheKey: string): Promise<ArrayBuffer | null> {
  const s = supa();
  if (!s) return null;
  const res = await fetch(`${s.base}/storage/v1/object/public/${CUTOUT_BUCKET}/cutout/${cacheKey}.png`).catch(() => null);
  if (!res || !res.ok) return null;
  return res.arrayBuffer();
}

async function putCutout(cacheKey: string, bytes: ArrayBuffer): Promise<void> {
  const s = supa();
  if (!s) return;
  await fetch(`${s.base}/storage/v1/object/${CUTOUT_BUCKET}/cutout/${cacheKey}.png`, {
    method: "POST",
    headers: { Authorization: `Bearer ${s.key}`, apikey: s.key, "Content-Type": "image/png", "x-upsert": "true" },
    body: new Blob([bytes], { type: "image/png" }),
  }).catch((err) => console.error("cutout cache write failed (ignored):", err));
}

/** Cutout bytes for a product: cache first, else remove + cache. Null if removal isn't possible. */
export async function getOrCreateCutout(cacheKey: string, imageUrl: string): Promise<ArrayBuffer | null> {
  const cached = await getCachedCutout(cacheKey);
  if (cached && cached.byteLength > 0) return cached;
  const cut = await removeBackground(imageUrl);
  if (!cut) return null;
  await putCutout(cacheKey, cut);
  return cut;
}
