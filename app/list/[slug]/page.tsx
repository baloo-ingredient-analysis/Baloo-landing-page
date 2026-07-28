import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getListBySlug } from "@/lib/db/queries/lists";
import { getProfileById } from "@/lib/db/queries/profiles";
import { getSessionUser } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { ListCover } from "@/components/lists/ListCover";
import { ShareButton } from "@/components/lists/ShareButton";
import { SavePill } from "@/components/engagement/SavePill";
import { LikePill } from "@/components/engagement/LikePill";
import { ReportControl } from "@/components/ReportControl";
import { isSaved } from "@/lib/db/queries/saves";
import { getVoteCount, hasVoted } from "@/lib/db/queries/votes";

// Public list page (Order G4) — the shareable growth surface. SSR from Postgres. A private list
// is visible only to its owner; everyone else gets a 404 (no existence leak).

type Params = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const dbi = db();
  if (!dbi) return null;
  const list = await getListBySlug(dbi, slug);
  if (!list) return null;
  // ownerId is nullable since S7a: a curator who deleted their account leaves the list ownerless,
  // and the render below already falls back to "by a Baloo user".
  const owner = list.ownerId ? await getProfileById(dbi, list.ownerId) : null;
  return { list, owner };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data || !data.list.isPublic) return { title: "Baloo" };
  const title = `${data.list.title} — Baloo`;
  const description =
    data.list.description ??
    `A list of ${data.list.items.length} products on Baloo${data.owner ? `, by @${data.owner.handle}` : ""}.`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: `/api/og/list/${slug}`, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [`/api/og/list/${slug}`] },
  };
}

export default async function ListPage({ params }: Params) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { list, owner } = data;

  const viewer = await getSessionUser();
  const isOwner = !!viewer && viewer.id === list.ownerId;
  if (!list.isPublic && !isOwner) notFound(); // private → owner only

  // Engagement state (Order G7; L8 adds the public Like alongside the private Save), SSR-hydrated.
  const dbi = db()!;
  const [viewerSaved, viewerLiked, likeCount] = await Promise.all([
    viewer ? isSaved(dbi, viewer.id, list.id) : Promise.resolve(false),
    viewer ? hasVoted(dbi, viewer.id, "list", list.id) : Promise.resolve(false),
    getVoteCount(dbi, "list", list.id),
  ]);

  return (
    <div className="relative flex min-h-screen flex-col">
      <SiteHeader
        action={
          isOwner ? (
            <Link
              href={`/list/${list.slug}/edit`}
              className="rounded-full border border-line bg-paper px-3.5 py-1.5 text-[13px] font-medium text-ink transition hover:border-ink/20"
            >
              Edit
            </Link>
          ) : undefined
        }
      />
      <main className="mx-auto flex w-full max-w-tool flex-1 flex-col px-5 pt-8">

        <section className="mt-8 animate-fade-in">
          <ListCover
            title={list.title}
            seed={list.slug}
            className="h-40 rounded-2xl sm:h-48"
            monogramClassName="text-7xl"
          />

          <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-3xl leading-tight text-ink">{list.title}</h1>
              {list.description && (
                <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-ink/80">
                  {list.description}
                </p>
              )}
              {/* Own-list cleanup (V3, Jitain): no "by @you" on your own list — keep it to the meta
                  that tells the reader something new. Non-owners still see who curated it. */}
              <p className="mt-3 text-sm text-muted">
                {isOwner ? (
                  <span className="text-muted/90">Your list</span>
                ) : owner ? (
                  <>
                    by{" "}
                    <Link href={`/u/${owner.handle}`} className="text-ink/70 underline decoration-line underline-offset-2 hover:text-ink">
                      @{owner.handle}
                    </Link>
                  </>
                ) : (
                  "by a Baloo user"
                )}
                {!list.isPublic && <span className="ml-2 text-muted/80">· private</span>}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {/* Two signals since L8: Like (public, feeds ranking) + Save (private library). You
                  don't like or save your own list, so both are hidden for the owner (V3 own-list
                  cleanup); Share stays (growth loop). */}
              {!isOwner && (
                <LikePill listId={list.id} initialLiked={viewerLiked} initialCount={likeCount} />
              )}
              {!isOwner && <SavePill listId={list.id} initialSaved={viewerSaved} />}
              <ShareButton
                path={`/list/${list.slug}`}
                title={list.title}
                cardPath={`/api/og/list/${list.slug}`}
              />
              {!isOwner && <ReportControl targetType="list" targetId={list.id} />}
            </div>
          </div>
        </section>

        {list.items.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-line bg-paper p-8 text-center shadow-card">
            <p className="font-display text-lg text-ink">Nothing here yet</p>
            {isOwner ? (
              <>
                <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">
                  Add a product to start building this list.
                </p>
                <Link
                  href={`/list/${list.slug}/edit`}
                  className="mt-4 inline-flex rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink/85"
                >
                  Add a product
                </Link>
              </>
            ) : (
              <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">
                This list doesn&rsquo;t have any products yet.
              </p>
            )}
          </div>
        ) : (
          <ul className="mt-8 overflow-hidden rounded-2xl border border-line bg-paper shadow-card [&>li+li]:border-t [&>li+li]:border-line">
            {list.items.map((item, i) => (
              <li key={item.id}>
                <Link
                  href={`/p/${item.product.slug}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-canvas sm:px-5"
                >
                  <span className="w-6 shrink-0 font-display text-[15px] tabular-nums text-muted/60">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-base leading-tight text-ink">
                      {item.product.name}
                    </span>
                    {item.product.brand && (
                      <span className="text-xs uppercase tracking-[0.08em] text-muted">
                        {item.product.brand}
                      </span>
                    )}
                    {item.note && <span className="mt-1 block text-sm text-muted">{item.note}</span>}
                  </span>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-4 w-4 shrink-0 text-muted">
                    <path d="M6 3.5L10.5 8 6 12.5" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8 text-center text-xs text-muted">
          Every product explained — tap any item.
        </p>

        <div className="mt-auto" />
      </main>
    </div>
  );
}
