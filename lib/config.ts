// Central constants. Keys are read from env at call sites, never hard-coded.

export const MODEL = "claude-sonnet-4-6";

// Cache time-to-live: 7 days, per the brief.
export const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

// API routes do a Firecrawl scrape + one or two Claude calls; give them room.
export const ROUTE_MAX_DURATION = 60;

// Max output tokens for the per-ingredient analysis (Order P2 — this was a real bug).
// The AI SDK's Anthropic provider defaults to 4096 output tokens. The Order-A prompt asks for
// 2-3 sentences of what_it_is AND why_its_here for EVERY ingredient, so a long label blows past
// 4096: the model stops at finishReason 'length', the object never validates, and the whole
// analysis is lost — silently, because the persist runs inside after(). Set it generously; we pay
// for tokens produced, not for the ceiling.
export const ANALYSIS_MAX_TOKENS = 16000;

// Retailers the brief commits to supporting. Used for client-side URL validation, the friendly
// error copy, and the homepage hero row. Extend by adding to this list.
// `countries` (Order GR1, ISO-3166 alpha-2 home markets) drives geo-ranking + Discover's "% available
// where you shop". `deliversTo` (optional) is cross-border shipping — a weaker signal (GR2). Derived
// here in code (the retailer set is small + static), never stored.
export type RetailerGeo = { name: string; countries: string[]; deliversTo?: string[] };

export const SUPPORTED_RETAILERS: (RetailerGeo & { match: string[] })[] = [
  { name: "Whole Foods", match: ["wholefoodsmarket.com", "wholefoods.com"], countries: ["US"] },
  { name: "Ocado", match: ["ocado.com"], countries: ["GB"] },
  { name: "Tesco", match: ["tesco.com"], countries: ["GB"] },
  { name: "Target", match: ["target.com"], countries: ["US"] },
  { name: "Kroger", match: ["kroger.com"], countries: ["US"] },
];

// EU + EEA + UK — the reach of a pan-European shipper like Koro. Kept as one constant so cross-border
// retailers share it.
export const EU_DELIVERY: string[] = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "GR", "HU", "IE", "IT", "LV", "LT",
  "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "GB",
];

// Retailers we can map geographically but do NOT (yet) accept as pasteable links or show on the
// homepage — geo-ranking only (GR1). Koro is the cross-border example (based in DE, ships across the
// EU + UK), so the "delivers-to" tier has a real case to rank and test against. Promote an entry into
// SUPPORTED_RETAILERS (with `match` domains) when we're ready to accept its product links.
export const EXTRA_RETAILER_GEO: RetailerGeo[] = [
  { name: "Koro", countries: ["DE"], deliversTo: EU_DELIVERY },
];

// Geo-ranking weights (Order GR2). One place to dial with Luna's testing.
//  - wDel: how much a cross-border "delivers here" counts vs. a retailer based here (1.0).
//  - lambdaFeed / lambdaSearch: how hard geo nudges the base ranking (feed strong, search light).
export const GEO_WEIGHTS = { wDel: 0.35, lambdaFeed: 0.6, lambdaSearch: 0.2 };
