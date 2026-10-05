// Server-side client for the recognition engine (Igor's partner API). SECRETS: the product key
// (`x-recognition-key`) must NEVER reach the browser — this module is server-only. Optional-infra like
// the rest of the app: when the keys are absent `recognitionEnabled()` is false and callers fall back
// to the web's own pipeline. Every call is bounded by a timeout so a slow/cold endpoint can't stall the
// request — the fallback relies on that bound. Any failure (timeout, network, non-200, bad JSON)
// resolves to null; the caller decides what to do.

import type { ExplainResponse, FindResponse } from "./types";

const DEFAULT_BASE = "https://rahjnurtpwygtaayzfgi.supabase.co/functions/v1";
const TIMEOUT_MS = 12_000; // explain-ingredients may call Claude on a cache miss, so give it room.

const base = () => (process.env.BALOO_RECOGNITION_URL ?? DEFAULT_BASE).replace(/\/+$/, "");
const anon = () => process.env.BALOO_RECOGNITION_ANON_KEY ?? "";
const key = () => process.env.BALOO_RECOGNITION_KEY ?? "";

export function recognitionEnabled(): boolean {
  return !!(anon() && key());
}

async function post<T>(path: string, body: unknown): Promise<T | null> {
  if (!recognitionEnabled()) return null;
  try {
    const res = await fetch(`${base()}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anon(), "x-recognition-key": key() },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null; // timeout / network / parse — caller falls back to the web's own pipeline.
  }
}

// Resolve an identity to a catalog match. Send a barcode, or brand + product_name (or both).
export function findProduct(input: {
  barcode?: string;
  brand?: string;
  productName?: string;
  locale?: string;
}): Promise<FindResponse | null> {
  const body: Record<string, unknown> = {};
  if (input.barcode) body.barcode = input.barcode;
  if (input.brand) body.brand = input.brand;
  if (input.productName) body.product_name = input.productName;
  if (input.locale) body.locale = input.locale;
  return post<FindResponse>("find-ingredients", body);
}

// Full per-ingredient breakdown + nutrition + product_summary for a matched variant. Default locale
// "en" (the web is English-first); the engine caches each language separately.
export function explainProduct(input: {
  variantId: string;
  locale?: string;
}): Promise<ExplainResponse | null> {
  return post<ExplainResponse>("explain-ingredients", {
    variant_id: input.variantId,
    locale: input.locale ?? "en",
    skip_explanations: false,
  });
}
