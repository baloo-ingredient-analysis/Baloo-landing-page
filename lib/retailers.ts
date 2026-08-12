import { SUPPORTED_RETAILERS, EXTRA_RETAILER_GEO } from "./config";

export type UrlCheck = { ok: true } | { ok: false; reason: string };

// Looks-like-a-link heuristic for the dual-intent search (paste a product URL vs. type a query):
// an explicit http(s) scheme, or a bare domain.tld optionally followed by a path. Shared by the
// homepage hero box (`HomeSearch`) and the app-shell search overlay (`HeaderSearch`, Order L1d-2).
export function looksLikeUrl(v: string): boolean {
  const s = v.trim();
  return /^https?:\/\//i.test(s) || /^[\w-]+(\.[\w-]+)+(\/|$)/.test(s);
}

// Client-side validation before any API call: must be http(s) and a recognised retailer.
export function validateUrl(raw: string): UrlCheck {
  const value = raw.trim();
  if (!value) return { ok: false, reason: "Paste a product link to get started." };

  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return { ok: false, reason: "That doesn't look like a full link. Include https://" };
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, reason: "Links need to start with http:// or https://" };
  }

  if (!detectRetailer(value)) {
    return {
      ok: false,
      reason: "Try a product link from Whole Foods, Ocado, Tesco, Target, or Kroger.",
    };
  }

  return { ok: true };
}

// Returns the retailer name for a URL, or null if it isn't one we support.
export function detectRetailer(url: string): string | null {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  for (const r of SUPPORTED_RETAILERS) {
    if (r.match.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
      return r.name;
    }
  }
  return null;
}

// Used by the API route as a server-side guard.
export function isSupportedUrl(url: string): boolean {
  return detectRetailer(url) !== null;
}

// ── Retailer geography (Order GR1) ──────────────────────────────────────────────────────────────
// One name→geography registry over the pasteable retailers PLUS geo-only ones (Koro). Countries are
// ISO-3166 alpha-2; `deliversTo` is cross-border shipping. Source of truth for both the legacy L7
// region soft-rank and GR2's weighted geo score.
const RETAILER_GEO: Map<string, { countries: string[]; deliversTo: string[] }> = new Map(
  [...SUPPORTED_RETAILERS, ...EXTRA_RETAILER_GEO].map((r) => [
    r.name,
    { countries: r.countries, deliversTo: r.deliversTo ?? [] },
  ]),
);

// "UK" is not an ISO code; Vercel geolocation returns "GB". Fold it so both spellings resolve.
function normCountry(country: string | null | undefined): string | null {
  const cc = (country ?? "").toUpperCase();
  if (!cc) return null;
  return cc === "UK" ? "GB" : cc;
}

// The home countries a retailer is based in (empty when unrecognised).
export function retailerCountries(name: string | null | undefined): string[] {
  return (name && RETAILER_GEO.get(name)?.countries) || [];
}

export type ServeTier = "home" | "delivers" | "none";

// How a retailer serves a given country: based there (home, strongest), ships there (delivers,
// weaker), or neither. Drives GR2's weighted availability.
export function retailerServes(name: string | null | undefined, country: string | null | undefined): ServeTier {
  const cc = normCountry(country);
  const geo = name ? RETAILER_GEO.get(name) : undefined;
  if (!cc || !geo) return "none";
  if (geo.countries.includes(cc)) return "home";
  if (geo.deliversTo.includes(cc)) return "delivers";
  return "none";
}

// ── Region (Order L7 — legacy binary market) ────────────────────────────────────────────────────
// Kept for the current Discover soft-rank + region picker until GR3 rewires ranking to countries.
// Derived from the geo registry so there's ONE source of truth (US-home → "US", GB-home → "UK").
export type Region = "US" | "UK";

export const REGIONS: { id: Region; label: string }[] = [
  { id: "US", label: "US" },
  { id: "UK", label: "UK" },
];

// The region a retailer name serves, or null if it isn't one we recognise / isn't US/UK-based.
export function retailerRegion(name: string | null | undefined): Region | null {
  const countries = retailerCountries(name);
  if (countries.includes("US")) return "US";
  if (countries.includes("GB")) return "UK";
  return null;
}

// Map a viewer's ISO country (from Vercel geolocation) to a Baloo region, or null when unknown.
export function countryToRegion(country: string | null | undefined): Region | null {
  const cc = (country ?? "").toUpperCase();
  if (cc === "US") return "US";
  if (cc === "GB" || cc === "UK") return "UK";
  return null;
}
