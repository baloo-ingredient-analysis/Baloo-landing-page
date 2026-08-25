// Commercial barcode food-database lookup — the PAID alternative to Open Food Facts, for the /compare
// tool (feat/off-compare). Provider-agnostic and keyed by barcode: given a barcode, return the paid
// source's record so we can put its ingredients next to OFF's for the SAME product and judge whether
// the commercial data is actually cleaner (the whole reason we're evaluating alternatives to OFF).
//
// Providers (barcode lookup only — neither has free keyword search):
//   • BarcodeNest — free tier, `GET /v1/products/{barcode}` + `X-API-Key` header.
//   • Chomp       — paid, `GET /api/v2/food/branded/barcode.php?api_key=&code=`.
//
// Optional-infra (same rule as Redis / OFF): with NO key configured every lookup is a no-op reporting
// `configured:false`, so the app builds and runs without it. SERVER-SIDE ONLY — holds the secret key;
// never import into a client component. Env: COMMERCIAL_DB_PROVIDER (barcodenest|chomp, optional),
// BARCODENEST_API_KEY, CHOMP_API_KEY.

export type CommercialRecord = {
  barcode: string;
  found: boolean;
  name: string | null;
  brand: string | null;
  ingredients: string | null; // raw ingredient text, exactly as the provider returns it
  provider: string;
};

type Provider = "barcodenest" | "chomp";

function providerConfig(): { provider: Provider; key: string } | null {
  const chomp = process.env.CHOMP_API_KEY;
  const bn = process.env.BARCODENEST_API_KEY;
  const pref = (process.env.COMMERCIAL_DB_PROVIDER || "").toLowerCase();
  if (pref === "chomp" && chomp) return { provider: "chomp", key: chomp };
  if (pref === "barcodenest" && bn) return { provider: "barcodenest", key: bn };
  // No explicit preference: use whichever key exists (BarcodeNest first — it has a free tier).
  if (bn) return { provider: "barcodenest", key: bn };
  if (chomp) return { provider: "chomp", key: chomp };
  return null;
}

export function commercialDbEnabled(): boolean {
  return providerConfig() !== null;
}
export function commercialDbProvider(): string | null {
  return providerConfig()?.provider ?? null;
}

const TIMEOUT_MS = 6000;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

async function fetchJson(url: string, headers?: Record<string, string>): Promise<unknown | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function miss(barcode: string, provider: Provider): CommercialRecord {
  return { barcode, found: false, name: null, brand: null, ingredients: null, provider };
}

async function lookupBarcodeNest(barcode: string, key: string): Promise<CommercialRecord> {
  const data = asRecord(await fetchJson(`https://api.barcodenest.com/v1/products/${encodeURIComponent(barcode)}`, { "X-API-Key": key }));
  const p = asRecord(data?.product);
  if (!data || data.found !== true || !p) return miss(barcode, "barcodenest");
  return { barcode, found: true, name: str(p.name), brand: str(p.brand), ingredients: str(p.ingredients), provider: "barcodenest" };
}

async function lookupChomp(barcode: string, key: string): Promise<CommercialRecord> {
  const data = asRecord(
    await fetchJson(`https://chompthis.com/api/v2/food/branded/barcode.php?api_key=${encodeURIComponent(key)}&code=${encodeURIComponent(barcode)}`),
  );
  // Chomp v2 returns { items: [ {...} ] }. Field names vary across records, so read defensively —
  // verify/tighten the mapping once we have a live key to inspect a real response.
  const items = Array.isArray(data?.items) ? (data!.items as unknown[]) : [];
  const item = asRecord(items[0]) ?? asRecord(data?.item);
  if (!item) return miss(barcode, "chomp");
  let ingredients = str(item.ingredient_list) ?? str(item.ingredients_text);
  if (!ingredients && Array.isArray(item.ingredients)) {
    ingredients =
      (item.ingredients as unknown[]).map((x) => str(asRecord(x)?.name) ?? str(x)).filter(Boolean).join(", ") || null;
  }
  if (!ingredients) ingredients = str(item.ingredients);
  return {
    barcode,
    found: true,
    name: str(item.name) ?? str(item.product_name),
    brand: str(item.brand) ?? str(item.brand_name),
    ingredients,
    provider: "chomp",
  };
}

/** Look up ONE barcode in the configured commercial DB. Null when no provider is configured;
 *  otherwise a record with found:false on any miss (never throws — optional-infra). */
export async function lookupCommercial(barcode: string): Promise<CommercialRecord | null> {
  const cfg = providerConfig();
  if (!cfg) return null;
  const code = barcode.replace(/\D/g, "");
  if (code.length < 8) return miss(code, cfg.provider);
  return cfg.provider === "chomp" ? lookupChomp(code, cfg.key) : lookupBarcodeNest(code, cfg.key);
}

/** Batch a handful of barcodes (deduped + capped) — these are PAID calls, so protect the credit budget. */
export async function lookupCommercialMany(barcodes: string[], cap = 10): Promise<CommercialRecord[]> {
  const cfg = providerConfig();
  if (!cfg) return [];
  const unique = [...new Set(barcodes.map((b) => b.replace(/\D/g, "")).filter((b) => b.length >= 8))].slice(0, cap);
  const out = await Promise.all(unique.map((b) => lookupCommercial(b)));
  return out.filter((r): r is CommercialRecord => r !== null);
}
