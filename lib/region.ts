// Region availability math (Order L7). Framework-agnostic — no db/next imports — so it stays
// portable (the mobile app can reuse it) and trivially unit-testable. The DB fetch lives in
// lib/db/queries/lists.ts; this file only does the arithmetic + wording.

import { retailerRegion, retailerServes, type Region } from "./retailers";
import { GEO_WEIGHTS } from "./config";

export type ListAvailability = {
  availableCount: number;
  total: number;
  pct: number; // 0..1; 0 when the list is empty
};

export type AvailabilityTone = "full" | "most" | "some" | "none";

// A product counts as available in `region` if ANY of its retailers serves that region. A product
// with no recognised retailer counts as unavailable (conservative — we never over-promise).
export function computeAvailability(
  perProductRetailers: Map<string, string[]>,
  region: Region,
): ListAvailability {
  const total = perProductRetailers.size;
  if (total === 0) return { availableCount: 0, total: 0, pct: 0 };
  let availableCount = 0;
  for (const retailers of perProductRetailers.values()) {
    if (retailers.some((r) => retailerRegion(r) === region)) availableCount++;
  }
  return { availableCount, total, pct: availableCount / total };
}

// One product's buyability in `country` (Order GR2): the BEST tier across its retailers —
// based-here = 1, delivers-here = wDel, else 0. Returns [0,1]. 0 for an unknown country / no
// recognised retailer.
export function productAvailability(
  retailers: string[],
  country: string | null | undefined,
  wDel: number = GEO_WEIGHTS.wDel,
): number {
  if (!country) return 0;
  let best = 0;
  for (const r of retailers) {
    const tier = retailerServes(r, country);
    const v = tier === "home" ? 1 : tier === "delivers" ? wDel : 0;
    if (v > best) best = v;
    if (best === 1) break; // can't beat a home match
  }
  return best;
}

// Weighted geo availability (Order GR2) — a LIST's ranking signal: the mean of its products'
// `productAvailability`. Returns a score in [0,1].
//
// Returns 0 for an empty list, an unknown country, or a list nobody sells where the user is. That's
// intentional: geo enters ranking as `base × (1 + λ·geo)` (GR3), so 0 means "no boost" — never a
// penalty, never a reason to hide a list. Distinct from L7's `computeAvailability`, which is binary
// and still powers the neutral UI badge.
export function weightedAvailability(
  perProductRetailers: Map<string, string[]>,
  country: string | null | undefined,
  wDel: number = GEO_WEIGHTS.wDel,
): number {
  const total = perProductRetailers.size;
  if (total === 0 || !country) return 0;
  let sum = 0;
  for (const retailers of perProductRetailers.values()) sum += productAvailability(retailers, country, wDel);
  return sum / total;
}

// Blend a base ranking (items already in base order, best first) with a geo score, returning the
// items re-sorted (Order GR3/GR4). score = base × (1 + λ·geo), where base = (N − i)/N from the
// incoming order — so the base ranking (engagement+recency for the feed, relevance for search) is
// preserved as magnitude, and geo only NUDGES: a geo=0 item keeps its base and is never buried; a
// local item is lifted. λ tunes the strength (feed strong, search light). Stable on ties (incoming
// order wins). A no-op when λ=0 or every geo=0 (unknown country).
export function blendGeoRank<T>(items: T[], geoOf: (item: T) => number, lambda: number): T[] {
  const n = items.length;
  if (n === 0) return items;
  return items
    .map((item, i) => ({ item, i, score: ((n - i) / n) * (1 + lambda * geoOf(item)) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((e) => e.item);
}

// Neutral, region-agnostic wording — no flags, no nationality. Empty lists get no label.
export function availabilityLabel(a: ListAvailability): { label: string; tone: AvailabilityTone } | null {
  if (a.total === 0) return null;
  if (a.pct >= 1) return { label: "Available where you shop", tone: "full" };
  if (a.pct >= 0.6) return { label: "Mostly available where you shop", tone: "most" };
  if (a.pct > 0) return { label: "Some available where you shop", tone: "some" };
  return { label: "Not sold where you shop", tone: "none" };
}
