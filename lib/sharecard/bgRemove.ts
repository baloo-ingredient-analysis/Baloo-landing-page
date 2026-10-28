// Background removal for the hybrid compositor — turns a product packshot into a transparent-PNG cutout,
// so the compositor can place the REAL product on a generated backdrop (never redrawing packaging).
//
// Provider: Higgsfield (same key as the hero provider). Async submit → poll → download, mirroring
// renderWithHiggsfield in generate.ts. Optional-infra: null without the key; best-effort: null on any
// failure, so the compositor simply drops that product (and the ladder falls back if none remain).
//
// Cutouts are cached in Supabase Storage keyed by a stable id (the product id), because a product's
// cutout is identical wherever it appears — removing it once per product, not once per card/list.
//
// ⚠️ VERIFY ON FIRST LIVE RUN: the exact Higgsfield REST path + response shape for background removal
// (HF_REMOVE_PATH / the result key) could not be confirmed in-session (no key in env). The call is
// written to the same contract as the marketing-studio endpoint; confirm against a live key and adjust
// HF_REMOVE_PATH / the result extraction if Higgsfield names them differently. Everything degrades
// safely until then (no cutout → designed card).

const HF_BASE = "https://api.higgsfield.ai";
const HF_REMOVE_PATH = "/image/remove-background"; // best-guess; verify against live API
const HF_POLL_MS = 3000;
const HF_TIMEOUT_MS = 30_000;

const CUTOUT_BUCKET = process.env.HERO_BUCKET || "share-heroes";

type Bytes = { buf: ArrayBuffer; contentType: string };

async function fetchBytes(url: string): Promise<Bytes | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return { buf: await res.arrayBuffer(), contentType: res.headers.get("content-type") || "image/png" };
  } catch {
    return null;
  }
}

/** Remove the background from a packshot URL → transparent PNG bytes. Null on any failure / no key. */
export async function removeBackground(imageUrl: string): Promise<ArrayBuffer | null> {
  const key = process.env.HIGGSFIELD_API_KEY;
  if (!key || !imageUrl) return null;
  const auth = { Authorization: `Key ${key}` };
  try {
    const submitRes = await fetch(`${HF_BASE}${HF_REMOVE_PATH}`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ image_url: imageUrl }),
    });
    if (!submitRes.ok) {
      console.error("bg-remove submit failed:", submitRes.status, await submitRes.text().catch(() => ""));
      return null;
    }
    const submit = await submitRes.json();
    // Some endpoints return the result inline; others return a request to poll. Handle both.
    const inlineUrl: string | undefined = submit?.image?.url ?? submit?.result?.url ?? submit?.url;
    if (inlineUrl) return (await fetchBytes(inlineUrl))?.buf ?? null;

    const statusUrl: string | undefined =
      submit?.status_url ?? (submit?.request_id ? `${HF_BASE}/requests/${submit.request_id}/status` : undefined);
    if (!statusUrl) return null;

    const deadline = Date.now() + HF_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, HF_POLL_MS));
      const stRes = await fetch(statusUrl, { headers: auth });
      if (!stRes.ok) continue;
      const st = await stRes.json();
      const status: string | undefined = st?.status;
      if (status === "completed") {
        const url: string | undefined = st?.image?.url ?? st?.images?.[0]?.url ?? st?.results?.[0]?.url;
        return url ? ((await fetchBytes(url))?.buf ?? null) : null;
      }
      if (status === "failed" || status === "canceled" || status === "nsfw") {
        console.error("bg-remove ended:", status);
        return null;
      }
    }
    console.error("bg-remove timed out");
    return null;
  } catch (err) {
    console.error("bg-remove error:", err);
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
