import { NextResponse } from "next/server";
import { searchOffRaw } from "@/lib/openfoodfacts";

export const runtime = "nodejs";

// RAW Open Food Facts search — the unfiltered half of the /compare tool (per Jitain). No catalog, no
// lists, no quality gate, no dedup, no country scope: exactly what OFF's search service returns for the
// query, plus the total count OFF reports (so we can compare recall/precision). `mode` selects the
// query shape for the brand-search experiment:
//   • text  (default) — free-text q=<query>, what the live pipeline uses.
//   • brand           — fielded q=brands_tags:"<normalized>", a precise brand match.
// Read-only, OFF is public + optional-infra (returns empty on failure). Not linked from the main app.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const mode = url.searchParams.get("mode") === "brand" ? "brand" : "text";
  if (q.trim().length < 2) return NextResponse.json({ off: [], total: 0, queried: "" });
  const { candidates, total, queried } = await searchOffRaw(q, mode, 25);
  return NextResponse.json({ off: candidates, total, queried });
}
