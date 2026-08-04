// Service-key auth for the public v1 API (mobile integration — see docs/API_CONTRACT_V1.md).
//
// This is a SEPARATE gate from lib/auth.ts (Supabase user sessions). These endpoints are called
// server-to-server by the mobile backend, not by a browser with a cookie, so they authenticate
// with a shared service key sent as `Authorization: Bearer <key>` or `x-api-key: <key>`.
//
// UNLIKE the optional-infra rule (cache/Redis/DB fail-open), auth here is FAIL-CLOSED: if no keys
// are configured the API is disabled (503), never open — these routes spend money (Claude +
// Firecrawl). Keys live in the BALOO_API_KEYS env var, comma-separated `label:secret` pairs:
//
//   BALOO_API_KEYS="mobile-prod:sk_live_xxx,mobile-dev:sk_test_yyy"
//
// A bare secret with no label is accepted too (label defaults to key1/key2/…). The label is
// returned so callers can be attributed and rate-limited per key without ever logging the secret.

import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";

export type ApiKeyResult = { keyId: string } | { error: NextResponse };

function sha256(s: string): Buffer {
  return createHash("sha256").update(s, "utf8").digest();
}

// Parsed once per process. Secrets are stored only as SHA-256 digests, never in plaintext memory
// beyond this call, and compared in constant time (see below).
function loadKeys(): { id: string; hash: Buffer }[] {
  const raw = process.env.BALOO_API_KEYS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((pair, i) => {
      const trimmed = pair.trim();
      if (!trimmed) return null;
      const idx = trimmed.indexOf(":");
      const [id, secret] =
        idx === -1 ? [`key${i + 1}`, trimmed] : [trimmed.slice(0, idx).trim(), trimmed.slice(idx + 1).trim()];
      if (!secret) return null;
      return { id: id || `key${i + 1}`, hash: sha256(secret) };
    })
    .filter((k): k is { id: string; hash: Buffer } => k !== null);
}

function presentedToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth && /^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, "").trim() || null;
  const x = req.headers.get("x-api-key");
  return x?.trim() || null;
}

function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "unauthorized", message: "Missing or invalid API key." },
    { status: 401 },
  );
}

/**
 * Gate a v1 API route. Mirrors lib/auth.ts's pattern: returns `{ keyId }` on success, or
 * `{ error: NextResponse }` the caller returns as-is.
 *
 *   const gate = requireApiKey(req);
 *   if ("error" in gate) return gate.error;
 *   // …use gate.keyId as the rate-limit bucket…
 */
export function requireApiKey(req: Request): ApiKeyResult {
  const keys = loadKeys();
  if (keys.length === 0) {
    return {
      error: NextResponse.json(
        { error: "api_not_configured", message: "This API is not enabled." },
        { status: 503 },
      ),
    };
  }

  const token = presentedToken(req);
  if (!token) return { error: unauthorized() };

  // Constant-time compare on fixed-length digests (avoids leaking secret length or match position).
  const presented = sha256(token);
  let matched: string | null = null;
  for (const k of keys) {
    if (k.hash.length === presented.length && timingSafeEqual(k.hash, presented)) {
      matched = k.id;
      // no early break — keep the loop's timing independent of which key matched
    }
  }
  return matched ? { keyId: matched } : { error: unauthorized() };
}
