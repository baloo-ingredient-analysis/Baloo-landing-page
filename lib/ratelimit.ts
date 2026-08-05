// Server-side rate limiting for the expensive / paid routes (Order S1).
//
// Optional, exactly like the cache: without the Upstash env vars every check is a no-op that
// ALLOWS (fail-open), so the app still boots and runs anywhere Redis isn't configured.
//
// ⚠️ This means rate limiting is INERT until UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
// exist. In production those must be set on Vercel — the Vercel Redis integration currently
// exposes only REDIS_URL, which this code does not read, so until that's fixed the money routes
// are unprotected in prod. (Tracked in Baloo_Checklist.md, owner M.)

import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { ipAddress } from "@vercel/functions";

// Named limiters — sliding window keeps short bursts honest. Tune the numbers here.
// Values are (requests, per window). A normal human analysing products stays well under these;
// a scripted for-loop hits them fast.
const LIMITS = {
  // Paid routes (Order S1) — keyed by IP.
  extract: { tokens: 15, window: "60 s" },
  analyse: { tokens: 15, window: "60 s" },
  nutritionContext: { tokens: 30, window: "60 s" },
  explain: { tokens: 20, window: "60 s" },
  productsAnalyze: { tokens: 10, window: "60 s" },
  // Semantic search (SS3) — embeds the query (a small paid call), keyed by IP. Generous for typing.
  search: { tokens: 30, window: "60 s" },
  // Public v1 API (mobile integration) — keyed by the service key's LABEL, not IP/user. Generous
  // for a backend caller; tighten per-endpoint when the paid routes land.
  apiV1: { tokens: 60, window: "60 s" },
  // Community writes (Order S4) — keyed by USER id. Generous enough that a normal person never
  // notices; a spam flood hits them fast. Deletes/edits/unfollows are intentionally uncapped.
  writeList: { tokens: 30, window: "1 d" }, // new lists per day
  listItem: { tokens: 120, window: "60 s" }, // add-to-list (bulk building a list is fine)
  comment: { tokens: 8, window: "60 s" },
  follow: { tokens: 30, window: "60 s" },
  save: { tokens: 40, window: "60 s" },
  pantry: { tokens: 40, window: "60 s" }, // save/unsave products to the Pantry (Order PP1)
  vote: { tokens: 60, window: "60 s" },
  report: { tokens: 8, window: "300 s" },
} as const;

// A hard maximum, enforced in code regardless of Upstash (unlike the rate limits, this is a
// correctness bound, not a burst guard — a list of 250 products is already enormous).
export const MAX_ITEMS_PER_LIST = 250;

export type LimiterName = keyof typeof LIMITS;

let redis: Redis | null | undefined;
function client(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

const limiters = new Map<LimiterName, Ratelimit>();
function limiter(name: LimiterName): Ratelimit | null {
  const c = client();
  if (!c) return null;
  let l = limiters.get(name);
  if (!l) {
    const { tokens, window } = LIMITS[name];
    l = new Ratelimit({
      redis: c,
      limiter: Ratelimit.slidingWindow(tokens, window),
      prefix: `baloo:rl:${name}`,
      analytics: false,
    });
    limiters.set(name, l);
  }
  return l;
}

// The caller's IP behind Vercel's proxy, with a header fallback for other hosts; "anon" when
// unknown (e.g. local dev has no Vercel headers — every local request shares one bucket).
export function clientIp(req: Request): string {
  return (
    ipAddress(req) ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "anon"
  );
}

export type LimitResult = { ok: boolean; remaining: number; reset: number };

// Fail-open when Upstash is absent or errors (optional-infra rule — never block real users over
// an unavailable optional dependency).
export async function checkLimit(name: LimiterName, id: string): Promise<LimitResult> {
  const l = limiter(name);
  if (!l) return { ok: true, remaining: Number.POSITIVE_INFINITY, reset: 0 };
  try {
    const { success, remaining, reset } = await l.limit(id);
    return { ok: success, remaining, reset };
  } catch (err) {
    console.error("ratelimit error (allowing):", err);
    return { ok: true, remaining: Number.POSITIVE_INFINITY, reset: 0 };
  }
}

// One calm 429 — never a raw error, matching the app's single-friendly-message contract.
export function tooMany(reset = 0): NextResponse {
  const retryAfter = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 1000)) : 30;
  return NextResponse.json(
    {
      error: "rate_limited",
      message: "You're going a little fast — give it a few seconds and try again.",
    },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
