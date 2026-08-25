// Product & ingredient identity (Order G3) — pure, portable. The dedup invariant lives here:
// two people analysing the same real-world product must produce the same canonical_key so they
// converge on one `products` row.

import { createHash } from "crypto";

// Lowercase, strip accents, non-alphanumerics → single spaces. The great equaliser: "Coca-Cola
// Zero!" and "coca cola zero" collapse to the same string.
export function normalizeName(s: string): string {
  // NFKD splits accents into base + combining mark; the [^a-z0-9] pass then drops the marks
  // (and every other separator), so "Coca-Cola Zero!" and "cocá cola zero" both land on the same
  // normalised string.
  return s
    .normalize("NFKD")
    // Drop combining diacritical marks FIRST — otherwise the [^a-z0-9] pass replaces a mid-word accent
    // (é = e + U+0301) with a SPACE, splitting the word: "zéro" → "ze ro", "José" → "jos e". Removing
    // the marks makes "zéro" → "zero", so accented and unaccented spellings truly collapse.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// Collapse near-duplicate listings of the SAME product that differ only by pack size, format, case,
// or accents ("Coca Cola Zero", "Coca Cola Zero 1,5l", "Coca Cola Zero - 330 ml", "COCA COLA ZERO",
// "Coca-cola zéro" → one entry). We strip size/quantity/multipack tokens from the name, then key on
// brand + the size-free name. Brand keeps two different brands' generically-named products ("Light",
// "Cola Zero") from merging; accents/case are already folded by normalizeName. Genuinely different
// variants (e.g. "…Zero" vs "…Zero Sugar") keep distinct names, so they still show separately.
const SIZE_TOKENS =
  /\b\d+[.,]?\d*\s?(l|ml|cl|dl|g|kg|mg|oz|cc)\b|\b\d+\s?[x×]\s?\d+[.,]?\d*\s?(l|ml|cl|g|kg)?\b|\b[x×]\s?\d+\b|\b\d+\s?(pack|uds?|units?|cans?|latas?|botellas?|bottles?)\b/g;

// ES→EN fold for the handful of label words that make one product look like two across languages
// ("Coca-Cola zero azúcar" vs "…Zero Sugar"). General to every product, not brand-specific. Maps to a
// single canonical (English) token so the Spanish and English listings of the SAME product collapse.
// Deliberately small and descriptor-only — it never touches a distinguishing variant word.
const ES_EN_SYNONYM: Record<string, string> = {
  azucar: "sugar", cero: "zero", sin: "without", con: "with", cafeina: "caffeine",
  descafeinado: "decaf", lima: "lime", limon: "lemon", naranja: "orange", fresa: "strawberry",
  sabor: "flavour", bebida: "drink", refresco: "soda",
};

// Generic packaging/marketing filler that NEVER identifies a product — dropped from the key so listings
// that differ only by these words collapse ("Barista" vs "Barista Edition vs "Barista Edition Long
// Life"). Cross-language, and deliberately CONSERVATIVE: distinctive words that really separate real
// products ("original", "natural", flavour names) are NOT here, so different variants stay apart.
const FILLER_WORDS = new Set([
  "edition", "edicion", "classic", "clasico", "premium", "bio", "organic", "organico", "ecologico",
  "eco", "uht", "pack", "formato", "ahorro", "receta", "style", "estilo", "long", "life", "the",
  "flavour", "flavoured", "flavored", "gout", "gusto",
]);

export function productDedupKey(
  input: { name: string; brand?: string | null },
  ignoreTokens?: Set<string>,
): string {
  // Name-only (brand deliberately excluded): OFF/catalog store ONE product under many brand spellings
  // ("Nutella" as brand Nutella / Ferrero / FerreroNutella), so keying on brand splits identical
  // products into separate rows. The name already carries the identity for a search, so we key on the
  // size-stripped, ES→EN-folded name alone — three "Nutella" listings collapse to one. Trade-off: two
  // different makers sharing a generic name ("Yogur Natural") also fold; the size/synonym folding keeps
  // it from being too broad, and distinctive names still separate real variants ("Nutella Biscuits").
  //
  // Tokens are SORTED (order-independent): "Oat Drink Barista Edition" and "Barista Edition Oat Drink"
  // are the same product written in a different word order, so they must key the same. This only ever
  // merges names with the IDENTICAL word SET — different flavours (Doritos "BBQ" vs "Nacho") differ by
  // a distinctive word, so their sets differ and they stay separate.
  // `ignoreTokens` = the query's own words. In a search for "oatly", every hit contains "oatly", so it
  // carries no identity for THAT query — dropping it lets "Oatly Oat Drink Barista" and "Oat Drink
  // Barista" collapse. The empty-name fallback below stops it from over-merging into one blank key.
  const tokens = normalizeName(input.name.toLowerCase().replace(SIZE_TOKENS, " "))
    .split(" ")
    .filter(Boolean)
    .map((w) => ES_EN_SYNONYM[w] ?? w)
    .filter((w) => !FILLER_WORDS.has(w) && !ignoreTokens?.has(w));
  // If a name is ALL filler, keep it rather than collapsing to empty (fall back to the raw tokens).
  const meaningful = tokens.length
    ? tokens
    : normalizeName(input.name.toLowerCase().replace(SIZE_TOKENS, " ")).split(" ").filter(Boolean);
  return meaningful.sort().join(" ");
}

// barcode when we have one (the OFF/Go-UPC source, later); else a normalised brand+name key.
// The retailer pipeline gives us name only, so today it's effectively name-based — good enough
// to dedup repeat scans of the same product, and upgraded automatically once barcodes arrive.
export function canonicalKey(input: { name: string; brand?: string | null; barcode?: string | null }): string {
  const digits = input.barcode?.replace(/\D/g, "");
  if (digits && digits.length >= 8) return `barcode:${digits}`;
  const basis = normalizeName([input.brand, input.name].filter(Boolean).join(" "));
  return `bn:${basis}`;
}

// Stable + unique: same product → same slug (from the canonical key), readable prefix from the
// name, short hash suffix to avoid collisions between different products with similar names.
export function productSlug(name: string, key: string): string {
  const base =
    normalizeName(name).replace(/\s+/g, "-").slice(0, 60).replace(/^-+|-+$/g, "") || "product";
  const suffix = createHash("sha256").update(key).digest("hex").slice(0, 6);
  return `${base}-${suffix}`;
}

// The key for the product-INDEPENDENT ingredient cache (brief §4.1): "Water" in any product maps
// to one `ingredients` row, so its what_it_is is generated once and reused everywhere.
export function ingredientKey(name: string): string {
  return normalizeName(name);
}
