import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { getProfileByHandle } from "@/lib/db/queries/profiles";
import { getPublicListsByOwnerWithCounts } from "@/lib/db/queries/lists";
import { getFollowCounts } from "@/lib/db/queries/follows";
import { ogCard } from "@/lib/ogCard";

// Per-profile Open Graph image (P8) — the card behind a shared @handle landing page. Uses the shared
// ogCard shell so it matches the list + product cards: chip = @handle, preview rows = the curator's
// public list titles. Privacy (L5c): a profile with no public list is private, so this renders the
// GENERIC card — it must never leak the name/bio of a private profile, even on a direct hit here.
// nodejs runtime (postgres.js isn't edge-safe).
export const runtime = "nodejs";

type Params = { params: Promise<{ handle: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { handle } = await params;
  const dbi = db();
  const profile = dbi ? await getProfileByHandle(dbi, handle.toLowerCase()) : null;
  const publicLists = dbi && profile ? await getPublicListsByOwnerWithCounts(dbi, profile.id) : [];
  // L5c: private (no public lists) → generic card, no name/bio.
  const isPublic = !!profile && publicLists.length > 0;
  const counts =
    dbi && isPublic ? await getFollowCounts(dbi, profile!.id) : { followers: 0, following: 0 };

  const nLists = publicLists.length;
  const card = isPublic
    ? ogCard({
        seed: profile!.handle,
        title: profile!.displayName,
        chip: `@${profile!.handle}`,
        meta: `${nLists} ${nLists === 1 ? "list" : "lists"} · ${counts.followers} ${
          counts.followers === 1 ? "follower" : "followers"
        }`,
        previewItems: publicLists.slice(0, 4).map((l) => l.title),
        moreCount: Math.max(0, nLists - 4),
      })
    : ogCard({ seed: "baloo", title: "Baloo", meta: "Know what's in your food" });

  return new ImageResponse(card, {
    width: 1200,
    height: 630,
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
