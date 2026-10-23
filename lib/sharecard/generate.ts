// Hero generation + storage (server-only, fetch-based — no SDK, so lib/ stays portable). Turns a
// product's packshot(s) into a warm "presented product" scene and stores it in Supabase Storage,
// returning the public URL. Used by BOTH the offline job (scripts/generate-heroes.ts) and the
// lazy-on-first-share trigger in the share routes.
//
// Provider is pluggable and chosen by which key is set (Higgsfield preferred — it keeps brand logos
// faithful, which gpt-image-1 does not; OpenAI gpt-image-1 is the fallback):
//   • HIGGSFIELD_API_KEY = "KEY_ID:KEY_SECRET"  → Higgsfield Marketing Studio Image (async submit+poll)
//   • OPENAI_API_KEY                            → OpenAI gpt-image-1 (image edit, synchronous)
// Plus storage: SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL and a public `share-heroes` bucket.
//
// Optional-infra: returns null (a no-op) when no provider or storage is configured, or on any failure —
// the card then falls back to the flat packshot. Never throws to the caller. See docs/SHARE_CARDS.md.

import { buildHeroPrompt, heroReferenceUrls, type HeroInput, type HeroRatio } from "./prompt";

const HERO_BUCKET = process.env.HERO_BUCKET || "share-heroes";

type Rendered = { bytes: ArrayBuffer; contentType: string };

/** True when some provider AND storage are configured (else generation is a no-op). */
export function heroGenerationConfigured(): boolean {
  const hasProvider = Boolean(process.env.HIGGSFIELD_API_KEY || process.env.OPENAI_API_KEY);
  return Boolean(
    hasProvider && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

async function download(url: string): Promise<Rendered | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return { bytes: await res.arrayBuffer(), contentType: res.headers.get("content-type") || "image/jpeg" };
  } catch {
    return null;
  }
}

// ── Higgsfield Marketing Studio Image (primary) ─────────────────────────────────────────────────────

const HF_BASE = "https://api.higgsfield.ai";
const HF_POLL_MS = 4000;
const HF_TIMEOUT_MS = 55_000;

function hfAspect(ratio: HeroRatio): string {
  if (ratio === "1:1") return "1:1";
  if (ratio === "9:16") return "9:16";
  return "3:4"; // 4:5 isn't offered; 3:4 is the nearest portrait (the card crops anyway)
}

async function renderWithHiggsfield(input: HeroInput): Promise<Rendered | null> {
  const key = process.env.HIGGSFIELD_API_KEY; // "KEY_ID:KEY_SECRET"
  if (!key) return null;
  const refs = heroReferenceUrls(input);
  if (refs.length === 0) return null; // no packshot to steer from
  const auth = { Authorization: `Key ${key}` };

  try {
    const submitRes = await fetch(`${HF_BASE}/marketing-studio/image`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        prompt: buildHeroPrompt(input),
        image_urls: refs, // editing mode: the packshots steer the real packaging
        resolution: "2k",
        aspect_ratio: hfAspect(input.ratio),
      }),
    });
    if (!submitRes.ok) {
      console.error("hero render (Higgsfield submit) failed:", submitRes.status, await submitRes.text().catch(() => ""));
      return null;
    }
    const submit = await submitRes.json();
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
        const url: string | undefined = st?.images?.[0]?.url ?? st?.results?.[0]?.url;
        return url ? download(url) : null;
      }
      if (status === "failed" || status === "nsfw" || status === "canceled") {
        console.error("hero render (Higgsfield) ended:", status);
        return null;
      }
      // queued / in_progress → keep polling
    }
    console.error("hero render (Higgsfield) timed out");
    return null;
  } catch (err) {
    console.error("hero render (Higgsfield) error:", err);
    return null;
  }
}

// ── OpenAI gpt-image-1 (fallback) ───────────────────────────────────────────────────────────────────

const OPENAI_IMAGE_MODEL = "gpt-image-1";
const IMAGE_QUALITY = process.env.HERO_IMAGE_QUALITY || "medium";

function openaiSize(ratio: HeroRatio): string {
  if (ratio === "1:1") return "1024x1024";
  return "1024x1536"; // portrait; the card crops to 4:5
}

async function fetchImageBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Blob([buf], { type: res.headers.get("content-type") || "image/jpeg" });
  } catch {
    return null;
  }
}

async function renderWithOpenAI(input: HeroInput): Promise<Rendered | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const refs = heroReferenceUrls(input);
  const blobs = (await Promise.all(refs.map(fetchImageBlob))).filter((b): b is Blob => b !== null);
  if (blobs.length === 0) return null;

  const form = new FormData();
  form.append("model", OPENAI_IMAGE_MODEL);
  form.append("prompt", buildHeroPrompt(input));
  form.append("size", openaiSize(input.ratio));
  form.append("quality", IMAGE_QUALITY);
  form.append("input_fidelity", "high"); // keep logos/text faithful (still weaker than Higgsfield)
  blobs.forEach((b, i) => {
    const ext = b.type.includes("png") ? "png" : b.type.includes("webp") ? "webp" : "jpg";
    form.append("image[]", b, `ref-${i}.${ext}`);
  });

  try {
    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) {
      console.error("hero render (OpenAI) failed:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json();
    const b64: string | undefined = data?.data?.[0]?.b64_json;
    if (!b64) return null;
    const nodeBuf = Buffer.from(b64, "base64");
    const ab = new ArrayBuffer(nodeBuf.byteLength);
    new Uint8Array(ab).set(nodeBuf);
    return { bytes: ab, contentType: "image/png" };
  } catch (err) {
    console.error("hero render (OpenAI) error:", err);
    return null;
  }
}

// ── Dispatch + storage ──────────────────────────────────────────────────────────────────────────────

/** Render the hero with the configured provider (Higgsfield preferred). Null on any failure. */
async function renderHero(input: HeroInput): Promise<Rendered | null> {
  if (process.env.HIGGSFIELD_API_KEY) return renderWithHiggsfield(input);
  if (process.env.OPENAI_API_KEY) return renderWithOpenAI(input);
  return null;
}

/** Upload bytes to the Supabase Storage bucket (upsert) and return the public URL, or null. */
async function uploadToSupabase(objectKey: string, bytes: ArrayBuffer, contentType: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const base = url.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/storage/v1/object/${HERO_BUCKET}/${objectKey}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": contentType, "x-upsert": "true" },
      body: new Blob([bytes], { type: contentType }),
    });
    if (!res.ok) {
      console.error("hero upload (Supabase) failed:", res.status, await res.text().catch(() => ""));
      return null;
    }
    return `${base}/storage/v1/object/public/${HERO_BUCKET}/${objectKey}`;
  } catch (err) {
    console.error("hero upload (Supabase) error:", err);
    return null;
  }
}

/** Render + store a hero; returns its public URL. Null (no-op) when unconfigured or on any failure.
 *  `objectKey` is the storage path without extension, e.g. "product/<id>" or "list/<id>". */
export async function generateAndStoreHero(input: HeroInput, objectKey: string): Promise<string | null> {
  if (!heroGenerationConfigured()) return null;
  const rendered = await renderHero(input);
  if (!rendered) return null;
  const ext = rendered.contentType.includes("png") ? "png" : rendered.contentType.includes("webp") ? "webp" : "jpg";
  return uploadToSupabase(`${objectKey}.${ext}`, rendered.bytes, rendered.contentType);
}
