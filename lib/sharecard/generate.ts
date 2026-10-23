// Hero generation + storage (server-only, fetch-based — no SDK, so lib/ stays portable). Turns a
// product's packshot(s) into a warm "presented product" scene (OpenAI gpt-image-1, image edit with the
// packshots as references) and stores it in Supabase Storage, returning the public URL. Used by BOTH
// the offline job (scripts/generate-heroes.ts) and the lazy-on-first-share trigger in the share routes.
//
// Optional-infra: returns null (a no-op) when OPENAI_API_KEY or the Supabase storage creds are absent,
// or on any provider/storage failure — the card then falls back to the flat packshot. Never throws to
// the caller; callers run it in after() and ignore the result beyond the returned URL.
//
// Cost: ~2-4¢ per render (gpt-image-1, medium), ONCE per product/list, then cached. See docs/SHARE_CARDS.md.

import { buildHeroPrompt, heroReferenceUrls, type HeroInput } from "./prompt";

const OPENAI_IMAGE_MODEL = "gpt-image-1";
const HERO_BUCKET = process.env.HERO_BUCKET || "share-heroes";
// gpt-image-1 quality: "low" | "medium" | "high" | "auto". Medium is the cost/quality sweet spot.
const IMAGE_QUALITY = process.env.HERO_IMAGE_QUALITY || "medium";

/** True when both the image provider and storage are configured (else generation is a no-op). */
export function heroGenerationConfigured(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

// Our ratio → the nearest gpt-image-1 size (it supports 1024² and the two 2:3 portraits/landscapes).
function sizeFor(ratio: HeroInput["ratio"]): string {
  if (ratio === "1:1") return "1024x1024";
  if (ratio === "9:16") return "1024x1536";
  return "1024x1536"; // 4:5 → nearest portrait; the card crops to 4:5
}

async function fetchImageBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const type = res.headers.get("content-type") || "image/jpeg";
    return new Blob([buf], { type });
  } catch {
    return null;
  }
}

/** Render the hero via OpenAI image edit (the packshots steer the real packaging). PNG bytes, or null. */
async function renderHero(input: HeroInput): Promise<ArrayBuffer | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const refs = heroReferenceUrls(input);
  const blobs = (await Promise.all(refs.map(fetchImageBlob))).filter((b): b is Blob => b !== null);
  if (blobs.length === 0) return null; // no packshot to steer from → nothing faithful to render

  const form = new FormData();
  form.append("model", OPENAI_IMAGE_MODEL);
  form.append("prompt", buildHeroPrompt(input));
  form.append("size", sizeFor(input.ratio));
  form.append("quality", IMAGE_QUALITY);
  // gpt-image-1 image edit accepts multiple reference images under `image[]`.
  blobs.forEach((b, i) => form.append("image[]", b, `ref-${i}.png`));

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
    // Copy into a fresh ArrayBuffer (a clean BlobPart; avoids Node Buffer / SharedArrayBuffer typing).
    const nodeBuf = Buffer.from(b64, "base64");
    const ab = new ArrayBuffer(nodeBuf.byteLength);
    new Uint8Array(ab).set(nodeBuf);
    return ab;
  } catch (err) {
    console.error("hero render (OpenAI) error:", err);
    return null;
  }
}

/** Upload bytes to the Supabase Storage bucket (upsert) and return the public URL, or null. */
async function uploadToSupabase(objectKey: string, bytes: ArrayBuffer, contentType = "image/png"): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const base = url.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/storage/v1/object/${HERO_BUCKET}/${objectKey}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
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
  const bytes = await renderHero(input);
  if (!bytes) return null;
  return uploadToSupabase(`${objectKey}.png`, bytes, "image/png");
}
