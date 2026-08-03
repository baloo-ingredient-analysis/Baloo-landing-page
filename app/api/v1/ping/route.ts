import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/apiAuth";
import { checkLimit, tooMany } from "@/lib/ratelimit";

// v1 public API — health + key check (mobile integration, see docs/API_CONTRACT_V1.md).
// Node runtime: apiAuth uses node:crypto. This is the reference gate every v1 route follows:
//   requireApiKey → per-key rate limit → work.
export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(req: Request) {
  const gate = requireApiKey(req);
  if ("error" in gate) return gate.error;

  const rl = await checkLimit("apiV1", gate.keyId);
  if (!rl.ok) return tooMany(rl.reset);

  return NextResponse.json({
    ok: true,
    service: "baloo-web",
    version: "v1",
    keyId: gate.keyId, // the resolved key LABEL — lets Igor confirm his credential end-to-end
    time: new Date().toISOString(),
  });
}
