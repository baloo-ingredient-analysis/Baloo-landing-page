import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { getProfileByHandle } from "@/lib/db/queries/profiles";
import { getPublicListsByOwnerWithCounts } from "@/lib/db/queries/lists";
import { getFollowCounts } from "@/lib/db/queries/follows";
import { coverTint, monogram } from "@/lib/cover";

// Per-profile Open Graph image (P8) — the card behind a shared @handle landing page. Mirrors the list
// and product cards (flat V3 tint + wordmark + monogram). Privacy (L5c): a profile with no public list
// is private, so this renders a GENERIC card — it must never leak the name/bio of a private profile,
// even on a direct hit to this route. nodejs runtime (postgres.js isn't edge-safe).
export const runtime = "nodejs";

type Params = { params: Promise<{ handle: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { handle } = await params;
  const dbi = db();
  const profile = dbi ? await getProfileByHandle(dbi, handle.toLowerCase()) : null;
  const publicLists = dbi && profile ? await getPublicListsByOwnerWithCounts(dbi, profile.id) : [];
  // L5c: private (no public lists) → generic card, no name/bio.
  const isPublic = !!profile && publicLists.length > 0;
  const counts = dbi && isPublic ? await getFollowCounts(dbi, profile!.id) : { followers: 0, following: 0 };

  const title = isPublic ? profile!.displayName : "Baloo";
  const tint = coverTint(isPublic ? profile!.handle : "baloo");
  const nLists = publicLists.length;
  const sub = isPublic
    ? `@${profile!.handle} · ${nLists} ${nLists === 1 ? "list" : "lists"} · ${counts.followers} ${
        counts.followers === 1 ? "follower" : "followers"
      }`
    : "Know what's in your food";

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: tint, // flat V3 tint (L1a); ink/muted hex inlined (renders outside Tailwind)
        }}
      >
        <div style={{ fontSize: 36, fontWeight: 700, color: "#2D2417" }}>Baloo</div>
        <div
          style={{
            position: "absolute",
            right: 40,
            bottom: -40,
            fontSize: 460,
            fontWeight: 700,
            color: "rgba(45,36,23,0.13)",
            lineHeight: 1,
          }}
        >
          {monogram(title)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 860 }}>
          <div style={{ fontSize: 66, fontWeight: 700, color: "#2D2417", lineHeight: 1.1 }}>{title}</div>
          <div style={{ fontSize: 30, color: "#766753" }}>{sub}</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    },
  );
}
