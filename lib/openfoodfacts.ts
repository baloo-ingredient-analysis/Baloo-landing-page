// Open Food Facts client + mapper (Order OFF1). The catalog's product source now that scraping
// retailer sites is a dead end (they block us and never publish the barcode). OFF is the free, global
// product database keyed by barcode; we look products up by barcode or name and map them into our
// internal shapes so the existing analysis + ingest pipeline can persist them, independent of any
// retailer. See docs/OFF_CATALOG.md.
//
// No API key. OFF asks for a descriptive User-Agent and gentle use (bulk seeding should use their data
// dumps, not this API). Optional-infra: any network or shape failure returns null / [], never throws —
// so search just serves the existing catalog when OFF is unreachable.

import type { Nutrition } from "./schema";
import { normalizeName } from "./canonical";

const OFF_BASE = "https://world.openfoodfacts.org";
const USER_AGENT = "Baloo/1.0 (https://baloo.life; ingredient analysis)";
const OFF_TIMEOUT_MS = 8_000;

// The fields we actually use — keep the payload small (OFF products are large).
const FIELDS = [
  "code", "product_name", "product_name_en", "brands", "quantity", "lang",
  "ingredients", "ingredients_text", "ingredients_text_en", "ingredients_text_es",
  "nutriments", "serving_size", "image_url", "image_front_url",
  "stores_tags", "stores", "countries_tags",
].join(",");

export type OffIngredient = { name: string; percent: string | null };

export type OffProduct = {
  barcode: string;
  name: string;
  brand: string | null;
  quantity: string | null;
  ingredientsText: string | null;
  ingredients: OffIngredient[]; // ordered, label order preserved
  nutrition: Nutrition | null;
  imageUrl: string | null;
  stores: string[];
  countries: string[];
};

// ── Pure mappers (unit-tested) ──────────────────────────────────────────────────────────────────

function firstOf(csv: unknown): string | null {
  if (typeof csv !== "string") return null;
  const first = csv.split(",")[0]?.trim();
  return first || null;
}

function cleanTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  // OFF tags look like "en:united-kingdom" or "mercadona" — strip the lang prefix, humanise dashes.
  return tags
    .map((t) => (typeof t === "string" ? t.replace(/^[a-z]{2}:/, "").replace(/-/g, " ").trim() : ""))
    .filter(Boolean);
}

// Pull a trailing "… 13%" or "… 8,7 %" off an ingredient token, returning the name + label percent.
function splitPercent(token: string): OffIngredient {
  const m = token.match(/[\s(]*(\d+(?:[.,]\d+)?)\s*%\s*\)?\s*$/);
  if (m && m.index !== undefined) {
    return { name: token.slice(0, m.index).trim(), percent: `${m[1].replace(",", ".")}%` };
  }
  return { name: token.trim(), percent: null };
}

function splitIngredientText(text: string): OffIngredient[] {
  return text
    .split(/,(?![^(]*\))/) // split on commas not inside parentheses
    .map((s) => s.replace(/\([^)]*\)/g, " ").replace(/[.:]+\s*$/, "").trim())
    .filter(Boolean)
    .map(splitPercent)
    .filter((i) => i.name);
}

function fromStructured(arr: unknown): OffIngredient[] {
  if (!Array.isArray(arr)) return [];
  const out: OffIngredient[] = [];
  for (const it of arr) {
    if (!it || typeof it !== "object") continue;
    const name = String((it as { text?: unknown }).text ?? "").trim();
    if (!name) continue;
    const pctRaw = (it as { percent?: unknown }).percent;
    const percent =
      pctRaw !== undefined && pctRaw !== null && `${pctRaw}`.trim() !== ""
        ? `${`${pctRaw}`.replace(/%/g, "").trim()}%`
        : null;
    out.push({ name, percent });
  }
  return out;
}

// Ordered, label-order ingredients — ENGLISH or SPANISH only. Baloo has no i18n yet, so we never
// surface Greek/German/etc. ingredient text: a product is only usable if it has an English or Spanish
// ingredient list. For an English/Spanish product the structured `ingredients` array is already in
// that language and carries clean DECLARED percents, so we use it; otherwise we fall back to the
// explicit `ingredients_text_en` / `_es` (which often still carry inline "13%", which we parse).
// Returns [] when there's no English/Spanish text — the import path then skips the product.
// `percent_estimate` is never used — our contract is the printed label %.
export function parseOffIngredients(
  raw: {
    ingredients?: unknown;
    ingredients_text?: unknown;
    ingredients_text_en?: unknown;
    ingredients_text_es?: unknown;
  },
  lang?: string,
): OffIngredient[] {
  const enText = typeof raw.ingredients_text_en === "string" ? raw.ingredients_text_en.trim() : "";
  const esText = typeof raw.ingredients_text_es === "string" ? raw.ingredients_text_es.trim() : "";
  const nativeSupported = lang === "en" || lang === "es";

  // Native English/Spanish product → the structured array is in that language, keep its exact percents.
  if (nativeSupported) {
    const out = fromStructured(raw.ingredients);
    if (out.length) return out;
  }
  // Else require an explicit English or Spanish text (a translation). No en/es text → unsupported → [].
  const text =
    enText || esText || (nativeSupported && typeof raw.ingredients_text === "string" ? raw.ingredients_text.trim() : "");
  return text ? splitIngredientText(text) : [];
}

// Map OFF's `nutriments` (per-100g/serving keys) into our canonical Nutrition panel. Values are copied
// as printed (stringified), never converted. Missing nutrients are simply omitted. Returns null when
// no recognised nutrient is present.
export function mapOffNutrition(raw: {
  nutriments?: Record<string, unknown>;
  serving_size?: unknown;
}): Nutrition | null {
  const n = raw.nutriments;
  if (!n || typeof n !== "object") return null;

  // [canonical name, OFF base key, unit]
  const MAP: [string, string, string][] = [
    ["Energy", "energy-kcal", "kcal"],
    ["Fat", "fat", "g"],
    ["Saturates", "saturated-fat", "g"],
    ["Carbohydrate", "carbohydrates", "g"],
    ["Sugars", "sugars", "g"],
    ["Fibre", "fiber", "g"],
    ["Protein", "proteins", "g"],
    ["Salt", "salt", "g"],
  ];

  const str = (v: unknown): string | null =>
    v === undefined || v === null || `${v}`.trim() === "" ? null : `${v}`;

  const nutrients = [];
  let anyServing = false;
  for (const [name, key, unit] of MAP) {
    const per100 = str(n[`${key}_100g`]);
    const perServ = str(n[`${key}_serving`]);
    if (per100 === null && perServ === null) continue;
    if (perServ !== null) anyServing = true;
    nutrients.push({ name, per_100g: per100, per_serving: perServ, unit });
  }
  if (!nutrients.length) return null;

  const serving = typeof raw.serving_size === "string" && raw.serving_size.trim() ? raw.serving_size.trim() : null;
  return {
    serving_size: serving,
    per: anyServing ? "both" : "100g",
    nutrients,
  };
}

// Normalise a raw OFF product JSON into our internal shape. Returns null without a usable name (a
// barcode with no name/ingredients is not worth a catalog row).
export function mapOffProduct(raw: Record<string, unknown>): OffProduct | null {
  const barcode = String(raw.code ?? "").replace(/\D/g, "");
  const name = String(raw.product_name_en || raw.product_name || "").trim();
  if (!name) return null;

  return {
    barcode,
    name,
    brand: firstOf(raw.brands),
    quantity: typeof raw.quantity === "string" && raw.quantity.trim() ? raw.quantity.trim() : null,
    ingredientsText:
      (typeof raw.ingredients_text_en === "string" && raw.ingredients_text_en.trim()) ||
      (typeof raw.ingredients_text === "string" && raw.ingredients_text.trim())
        ? String(raw.ingredients_text_en || raw.ingredients_text).trim()
        : null,
    ingredients: parseOffIngredients(raw, typeof raw.lang === "string" ? raw.lang : undefined),
    nutrition: mapOffNutrition(raw),
    imageUrl:
      (typeof raw.image_front_url === "string" && raw.image_front_url) ||
      (typeof raw.image_url === "string" && raw.image_url) ||
      null,
    stores: cleanTags(raw.stores_tags).length ? cleanTags(raw.stores_tags) : (firstOf(raw.stores) ? [firstOf(raw.stores)!] : []),
    countries: cleanTags(raw.countries_tags),
  };
}

// ── Network (optional-infra: null/[] on any failure) ────────────────────────────────────────────

async function offFetch(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), OFF_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Look up ONE product by barcode. Null if OFF doesn't have it or the fetch fails. */
export async function getOffProductByBarcode(barcode: string): Promise<OffProduct | null> {
  const code = barcode.replace(/\D/g, "");
  if (code.length < 8) return null;
  const data = (await offFetch(`${OFF_BASE}/api/v2/product/${code}.json?fields=${FIELDS}`)) as
    | { status?: number; product?: Record<string, unknown> }
    | null;
  if (!data || data.status !== 1 || !data.product) return null;
  return mapOffProduct(data.product);
}

// A lightweight search hit — enough to pick a product, then hydrate the full one by barcode. We use
// OFF's dedicated search service (search-a-licious): ~10x faster than the legacy cgi/search.pl, better
// ranked, and it returns clean JSON (search.pl intermittently returns an HTML error page).
export type OffCandidate = { barcode: string; name: string; brand: string | null };

const OFF_SEARCH = "https://search.openfoodfacts.org/search";

// Map a viewer's ISO country (Vercel geo) to the country name OFF tags products with (as produced by
// cleanTags: lowercased, dashes → spaces). Used to prefer the product's local version, since the same
// product's ingredients differ by market. Only the markets we care about; unknown → no preference.
const COUNTRY_TAG: Record<string, string> = {
  ES: "spain", GB: "united kingdom", UK: "united kingdom", US: "united states",
  FR: "france", DE: "germany", IT: "italy", PT: "portugal", NL: "netherlands",
  BE: "belgium", IE: "ireland", AT: "austria", CH: "switzerland", PL: "poland",
  MX: "mexico", AR: "argentina", CO: "colombia", CL: "chile",
};

/** Search OFF by name, best first — barcode + name candidates. English/Spanish products only (Baloo
 *  has no i18n), and deduped so five near-identical "Coca Cola Zero" entries collapse to one. When a
 *  `country` (ISO, from Vercel geo) is given, the product's LOCAL version is preferred — since the
 *  same product's ingredients differ by market — as a soft nudge (local first, then the rest), so the
 *  version kept through dedup is the one sold where the user is. Hydrate a choice via
 *  getOffProductByBarcode. */
export async function searchOffCandidates(
  query: string,
  limit = 5,
  country?: string | null,
): Promise<OffCandidate[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  // Over-fetch: language filtering + dedup shrink the list, so ask for more than we need.
  const url =
    `${OFF_SEARCH}?q=${encodeURIComponent(q)}` +
    `&page_size=25&fields=code,product_name,product_name_en,brands,lang,countries_tags`;
  const data = (await offFetch(url)) as { hits?: Record<string, unknown>[] } | null;
  if (!data || !Array.isArray(data.hits)) return [];

  const localName = country ? COUNTRY_TAG[country.toUpperCase()] ?? null : null;

  // First pass: keep English/Spanish hits, flagging which are sold in the viewer's country.
  const rows: { c: OffCandidate; isLocal: boolean; i: number }[] = [];
  data.hits.forEach((h, i) => {
    const lang = typeof h.lang === "string" ? h.lang : "";
    if (lang !== "en" && lang !== "es") return; // English/Spanish only

    const barcode = String(h.code ?? "").replace(/\D/g, "");
    const name = String(h.product_name_en || h.product_name || "").replace(/\s+/g, " ").trim();
    if (barcode.length < 8 || !name) return;

    const brands = h.brands;
    const brand = Array.isArray(brands)
      ? (typeof brands[0] === "string" ? brands[0] : null)
      : firstOf(brands);
    const isLocal = Boolean(localName && cleanTags(h.countries_tags).includes(localName));
    rows.push({ c: { barcode, name, brand }, isLocal, i });
  });

  // Soft geo nudge: local versions first, OFF's relevance order preserved within each group.
  rows.sort((a, b) => Number(b.isLocal) - Number(a.isLocal) || a.i - b.i);

  // Collapse duplicate entries of the same product (different barcodes/countries/contributors). OFF
  // brands are inconsistent, so dedupe on the normalised NAME alone — and because local is sorted
  // first, the version kept is the local one when it exists.
  const out: OffCandidate[] = [];
  const seen = new Set<string>();
  for (const { c } of rows) {
    const key = normalizeName(c.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}
