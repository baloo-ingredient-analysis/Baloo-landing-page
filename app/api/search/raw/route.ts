import { NextResponse } from "next/server";
import { searchOffCandidatesRaw } from "@/lib/openfoodfacts";

export const runtime = "nodejs";

// RAW Open Food Facts search — the unfiltered half of the /compare tool (per Jitain). No catalog, no
// lists, no quality gate, no dedup, no country scope: it returns exactly what OFF's search service
// gives back for the query, so we can judge how messy the raw data is against our filtered pipeline
// (/api/search). Read-only, OFF is public + optional-infra (returns [] on failure). Not linked from
// the main app.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ off: [] });
  const off = await searchOffCandidatesRaw(q, 25);
  return NextResponse.json({ off });
}
