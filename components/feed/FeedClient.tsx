"use client";

// The morning-paper feed (Order G6, D-G6 handoff §2–§6): chronological, day-grouped, hairline
// articles; load-more never infinite; two empty flavours that teach following. Zero engagement
// mechanics by design.

import { useState } from "react";
import Link from "next/link";
import { coverCss, monogram } from "@/lib/cover";
import { profilePath } from "@/lib/profilePath";
import { ListCover } from "@/components/lists/ListCover";
import { FollowButton } from "@/components/FollowButton";
import type { FeedArticle, FeedPage } from "@/lib/db/queries/feed";

type Suggested = {
  id: string;
  handle: string;
  displayName: string;
  publicLists: number;
  followers: number;
};

export function FeedClient({
  initial,
  hasFollows,
  suggested,
}: {
  initial: FeedPage;
  hasFollows: boolean;
  suggested: Suggested[];
}) {
  const [articles, setArticles] = useState<FeedArticle[]>(initial.articles);
  const [nextBefore, setNextBefore] = useState<string | null>(initial.nextBefore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const [followedNow, setFollowedNow] = useState(false);

  async function refetch() {
    try {
      const res = await fetch("/api/feed");
      const page: FeedPage = await res.json();
      setArticles(page.articles);
      setNextBefore(page.nextBefore);
    } catch {
      /* keep whatever we have */
    }
  }

  async function loadMore() {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    const spinnerTimer = setTimeout(() => setShowSpinner(true), 400); // D-G6 §4
    try {
      const res = await fetch(`/api/feed?before=${encodeURIComponent(nextBefore)}`);
      const page: FeedPage = await res.json();
      setArticles((prev) => [...prev, ...page.articles]); // append, never jump
      setNextBefore(page.nextBefore);
    } catch {
      /* button stays; user can retry */
    } finally {
      clearTimeout(spinnerTimer);
      setShowSpinner(false);
      setLoadingMore(false);
    }
  }

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <section className="animate-fade-in">
      {/* Masthead — the paper's nameplate (D-G6 §2). */}
      <div className="mt-10 flex items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="font-display text-[30px] leading-tight text-ink">Following</h1>
          <p className="mt-1 text-sm text-muted">
            The lists and picks from the people you follow.
          </p>
        </div>
        <p className="shrink-0 text-xs tabular-nums text-muted">{today}</p>
      </div>

      {articles.length === 0 ? (
        <EmptyState hasFollows={hasFollows || followedNow} suggested={suggested} onFollowed={() => {
          setFollowedNow(true);
          refetch();
        }} />
      ) : (
        <>
          {groupByDay(articles).map((group) => (
            <div key={group.label}>
              <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.13em] text-muted">
                {group.label}
              </p>
              {group.items.map((a, i) => (
                <Article key={`${a.ts}-${i}`} article={a} />
              ))}
            </div>
          ))}

          <div className="mt-8 flex justify-center">
            {nextBefore ? (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 rounded-full border border-line bg-paper px-5 py-2 text-sm font-medium text-ink transition hover:border-[#dedcd2] hover:bg-canvas disabled:opacity-60"
              >
                {showSpinner && (
                  <span
                    aria-hidden
                    className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-natural"
                  />
                )}
                Load earlier activity
              </button>
            ) : (
              <p className="text-sm text-muted">You&apos;re all caught up.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

// ── Articles ─────────────────────────────────────────────────────────────────────────────────

function Article({ article }: { article: FeedArticle }) {
  return (
    <article className="animate-rise border-b border-line py-4">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-canvas font-display text-xs text-ink/40"
        >
          {monogram(article.actor.displayName)}
        </span>
        <p className="min-w-0 flex-1 text-sm leading-snug">
          <Link href={profilePath(article.actor.handle)} className="font-medium text-ink hover:underline">
            @{article.actor.handle}
          </Link>{" "}
          <span className="text-muted">
            {article.kind === "created_list"
              ? "created a list"
              : `added ${article.count} ${article.count === 1 ? "product" : "products"} to`}
          </span>{" "}
          {article.kind === "added_items" && (
            <Link href={`/list/${article.list.slug}`} className="font-medium text-ink hover:underline">
              &quot;{article.list.title}&quot;
            </Link>
          )}
        </p>
        <time className="shrink-0 text-xs tabular-nums text-muted" dateTime={article.ts}>
          {relTime(article.ts)}
        </time>
      </div>

      {article.kind === "created_list" ? (
        // The richest event earns the card (D-G6 §3b) — same anatomy as the shipped ListCard.
        <Link
          href={`/list/${article.list.slug}`}
          className="group mt-3 block overflow-hidden rounded-2xl border border-line bg-paper shadow-card transition duration-200 hover:shadow-card-hover sm:ml-9"
        >
          <ListCover title={article.list.title} seed={article.list.slug} className="h-20" monogramClassName="text-4xl" />
          <div className="p-4">
            <h3 className="font-display text-[19px] leading-tight text-ink group-hover:underline">
              {article.list.title}
            </h3>
            {article.list.description && (
              <p className="mt-1 line-clamp-2 text-[13px] text-muted">{article.list.description}</p>
            )}
            <p className="mt-2 text-xs tabular-nums text-muted">
              {article.list.itemCount} {article.list.itemCount === 1 ? "product" : "products"}
            </p>
          </div>
        </Link>
      ) : (
        // A receipt of what changed — not a card (D-G6 §3b).
        <div className="mt-3 rounded-xl border border-line bg-paper sm:ml-9">
          {article.products.length > 0 ? (
            <ul className="[&>li+li]:border-t [&>li+li]:border-line">
              {article.products.map((p) => (
                <li key={p.slug}>
                  <Link href={`/p/${p.slug}`} className="flex items-center gap-3 px-3.5 py-2.5 transition hover:bg-canvas">
                    <span
                      aria-hidden
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas font-display text-sm text-ink/30"
                    >
                      {(p.brand ?? p.name)[0]?.toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-[15px] text-ink">{p.name}</span>
                      {p.brand && <span className="text-xs text-muted">{p.brand}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3.5 py-2.5 text-sm text-muted">Products added earlier.</p>
          )}
          <Link
            href={`/list/${article.list.slug}`}
            className="block border-t border-line px-3.5 py-2 text-[13px] font-medium text-muted transition hover:text-ink"
          >
            View the list →
          </Link>
        </div>
      )}
    </article>
  );
}

// ── Empty state (two flavours, D-G6 §5) ──────────────────────────────────────────────────────

function EmptyState({
  hasFollows,
  suggested,
  onFollowed,
}: {
  hasFollows: boolean;
  suggested: Suggested[];
  onFollowed: () => void;
}) {
  return (
    <div className="mt-10 animate-fade-in">
      <h2 className="font-display text-2xl text-ink">
        {hasFollows ? "Nothing new from the people you follow." : "Your feed is quiet."}
      </h2>
      <p className="mt-2 max-w-[520px] text-sm leading-relaxed text-muted">
        {hasFollows
          ? "Here's who's been active lately:"
          : "Follow a few curators and their lists, picks and updates collect here — like a morning paper you skim with coffee. Start with these:"}
      </p>

      {suggested.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-paper shadow-card [&>div+div]:border-t [&>div+div]:border-line">
          {suggested.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3">
              <span
                aria-hidden
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full"
                style={{ background: coverCss(s.handle) }}
              >
                <span className="font-display text-base font-semibold text-ink/25">
                  {monogram(s.displayName)}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <Link href={profilePath(s.handle)} className="block truncate font-display text-base text-ink hover:underline">
                  {s.displayName}
                </Link>
                <span className="text-xs tabular-nums text-muted">
                  @{s.handle} · {s.publicLists} {s.publicLists === 1 ? "list" : "lists"} ·{" "}
                  {s.followers} {s.followers === 1 ? "follower" : "followers"}
                </span>
              </span>
              <FollowButton profileId={s.id} initialFollowing={false} ghost onChange={onFollowed} />
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-sm">
        <Link href="/discover" className="text-muted underline decoration-line underline-offset-2 transition hover:text-ink">
          Or browse all lists →
        </Link>
      </p>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "Earlier this week";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

function groupByDay(articles: FeedArticle[]): { label: string; items: FeedArticle[] }[] {
  const groups: { label: string; items: FeedArticle[] }[] = [];
  for (const a of articles) {
    const label = dayLabel(a.ts);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(a);
    else groups.push({ label, items: [a] });
  }
  return groups;
}
