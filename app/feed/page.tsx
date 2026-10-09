import type { Metadata } from "next";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import { getCurrentProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { getFeed } from "@/lib/db/queries/feed";
import { getFollowingIds, getSuggestedCurators } from "@/lib/db/queries/follows";
import { SiteHeader } from "@/components/SiteHeader";
import { FeedClient } from "@/components/feed/FeedClient";

export const metadata: Metadata = {
  title: "Following — Baloo",
  description: "The lists and picks from the people you follow.",
};

// The signed-in home feed (Order G6, D-G6 handoff). Lives at /feed for now — promoting it to
// the signed-in homepage is a one-line change pending Jitain's call on demoting the scanner.
export default async function FeedPage() {
  const auth = await getCurrentProfile();
  const dbi = db();

  if (!auth || !dbi) {
    return (
      <Shell>
        <p className="mt-10 text-sm text-muted">
          Your feed lives here once you&apos;re signed in — use the top-right menu, then follow a
          few curators.
        </p>
      </Shell>
    );
  }
  if (!auth.profile) {
    return (
      <Shell>
        <p className="mt-10 text-sm text-muted">
          One step left —{" "}
          <LocalizedLink href="/welcome" className="underline decoration-line underline-offset-2 hover:text-ink">
            choose your handle
          </LocalizedLink>{" "}
          and your feed opens up.
        </p>
      </Shell>
    );
  }

  const [initial, followingIds, suggested] = await Promise.all([
    getFeed(dbi, auth.user.id),
    getFollowingIds(dbi, auth.user.id),
    getSuggestedCurators(dbi, auth.user.id),
  ]);

  return (
    <Shell>
      <FeedClient
        initial={initial}
        hasFollows={followingIds.length > 0}
        suggested={suggested.map((s) => ({
          id: s.id,
          handle: s.handle,
          displayName: s.displayName,
          publicLists: s.publicLists,
          followers: s.followers,
        }))}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-tool flex-1 flex-col px-5 pb-16 pt-8">
        {children}
        <div className="mt-auto" />
      </main>
    </div>
  );
}
