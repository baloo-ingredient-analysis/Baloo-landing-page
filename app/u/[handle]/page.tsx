import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getProfileByHandle } from "@/lib/db/queries/profiles";
import {
  getListsByOwnerWithCounts,
  getPublicListsByOwnerWithCounts,
  type ListWithCountsAndOwner,
} from "@/lib/db/queries/lists";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getFollowCounts, isFollowing } from "@/lib/db/queries/follows";
import { getSavedListsWithCounts } from "@/lib/db/queries/saves";
import { getPantry } from "@/lib/db/queries/pantry";
import { coverCss, monogram } from "@/lib/cover";
import { SiteHeader } from "@/components/SiteHeader";
import { FollowButton } from "@/components/FollowButton";
import { ShareButton } from "@/components/lists/ShareButton";
import { ProfileLists } from "@/components/profile/ProfileLists";
import { PantryGrid } from "@/components/profile/PantryGrid";

// Public profile (Order G5; PP2 makes it Pinterest-style). Two tabs: PANTRY (your saved products —
// owner-only, private) and LISTS (your created lists AND lists you've saved, unified). Visitors see
// only public created lists; the Pantry tab never renders for them. Follow wires up in G6.

type Params = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ tab?: string }>;
};

async function load(handle: string) {
  const dbi = db();
  if (!dbi) return null;
  const profile = await getProfileByHandle(dbi, handle.toLowerCase());
  if (!profile) return null;
  return { dbi, profile };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  const data = await load(handle);
  if (!data) return { title: "Baloo" };
  // L5c: a profile with no public lists is private — don't leak its name/bio to crawlers or social.
  const publicLists = await getPublicListsByOwnerWithCounts(data.dbi, data.profile.id);
  if (publicLists.length === 0) return { title: "Baloo" };
  return {
    title: `@${data.profile.handle} — Baloo`,
    description: data.profile.bio ?? `${data.profile.displayName}'s lists on Baloo.`,
  };
}

export default async function ProfilePage({ params, searchParams }: Params) {
  const { handle } = await params;
  const { tab } = await searchParams;
  const data = await load(handle);
  if (!data) notFound();
  const { dbi, profile } = data;

  const viewer = await getSessionUser();
  const isOwner = viewer?.id === profile.id;
  // Owner-only Pantry; default to Pantry for the owner (their own stuff first), Lists for visitors.
  const activeTab = tab === "pantry" && isOwner ? "pantry" : tab === "lists" ? "lists" : isOwner ? "pantry" : "lists";

  // Lists: owner sees own (incl. private) + saved-from-others, unified; a visitor sees public only.
  const own = isOwner
    ? await getListsByOwnerWithCounts(dbi, profile.id)
    : await getPublicListsByOwnerWithCounts(dbi, profile.id);
  // L5c: a profile is private until it has ≥1 public list. For a visitor `own` is already public-only.
  if (!isOwner && own.length === 0) notFound();
  const publicCount = own.filter((l) => l.isPublic).length;

  const ownWithHandle: ListWithCountsAndOwner[] = own.map((l) => ({ ...l, ownerHandle: profile.handle }));
  const savedLists = isOwner
    ? await getSavedListsWithCounts(dbi, profile.id, { publicOnly: false })
    : [];
  const seen = new Set(ownWithHandle.map((l) => l.id));
  const unifiedLists = [...ownWithHandle, ...savedLists.filter((l) => !seen.has(l.id))];

  const pantry =
    isOwner && activeTab === "pantry"
      ? (await getPantry(dbi, profile.id)).map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          brand: p.brand,
        }))
      : [];

  const joinedYear = profile.createdAt.getFullYear();
  const counts = await getFollowCounts(dbi, profile.id);
  const viewerFollows = viewer && !isOwner ? await isFollowing(dbi, viewer.id, profile.id) : false;

  const tabCls = (active: boolean) =>
    `-mb-px border-b-2 py-3 text-[15px] transition ${
      active
        ? "border-natural font-semibold text-ink"
        : "border-transparent font-medium text-muted hover:text-ink"
    }`;

  return (
    <div className="relative flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-tool flex-1 flex-col px-5 pt-8">
        <section className="mt-10 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              {/* Avatar: generated cover language, seeded by handle — no photos, on brand. */}
              <span
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
                style={{ background: coverCss(profile.handle) }}
                aria-hidden
              >
                <span className="font-display text-2xl font-semibold text-ink/25">
                  {monogram(profile.displayName)}
                </span>
              </span>
              <div className="min-w-0">
                <h1 className="truncate font-display text-[28px] leading-tight text-ink">
                  {profile.displayName}
                </h1>
                <p className="text-sm text-muted">@{profile.handle}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* Nothing public to share until the profile is public (L5c). */}
              {publicCount > 0 && (
                <ShareButton path={`/u/${profile.handle}`} title={profile.displayName} />
              )}
              <FollowButton profileId={profile.id} initialFollowing={viewerFollows} />
            </div>
          </div>

          {profile.bio && (
            <p className="mt-4 max-w-[520px] text-[15px] leading-relaxed text-ink/80">
              {profile.bio}
            </p>
          )}
          <p className="mt-3 text-sm tabular-nums text-muted">
            Joined {joinedYear} · {counts.followers}{" "}
            {counts.followers === 1 ? "follower" : "followers"} · {counts.following} following ·{" "}
            {publicCount} public {publicCount === 1 ? "list" : "lists"}
          </p>
          {isOwner && publicCount === 0 && (
            <p className="mt-4 rounded-xl border border-line bg-canvas px-4 py-3 text-sm text-muted">
              Your profile is private. <span className="font-medium text-ink">Publish a list</span> to
              make it discoverable.
            </p>
          )}
        </section>

        {/* Tabs (PP2): Pantry (owner-only, private) + Lists (unified). Link-tabs, SSR. */}
        <div role="tablist" aria-label="Profile views" className="mt-6 flex gap-6 border-b border-line">
          {isOwner && (
            <Link
              role="tab"
              aria-selected={activeTab === "pantry"}
              href={`/u/${profile.handle}?tab=pantry`}
              className={tabCls(activeTab === "pantry")}
            >
              Pantry
            </Link>
          )}
          <Link
            role="tab"
            aria-selected={activeTab === "lists"}
            href={`/u/${profile.handle}?tab=lists`}
            className={tabCls(activeTab === "lists")}
          >
            Lists
          </Link>
        </div>

        {activeTab === "pantry" ? (
          <PantryGrid products={pantry} />
        ) : (
          <ProfileLists lists={unifiedLists} isOwner={isOwner} />
        )}

        <div className="mt-auto" />
      </main>
    </div>
  );
}
