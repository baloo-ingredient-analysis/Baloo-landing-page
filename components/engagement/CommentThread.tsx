"use client";

// Product discussion (Order G8, D-G7/G8 handoff §4). Community = opinion: card-less hairline
// rows, one level of replies, upvote + reply. The factual voice is Baloo's "Explain this" card
// (G8b), never a vote on a comment. Calm by default — the composer collapses when empty.

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/useAuth";
import { profilePath } from "@/lib/profilePath";
import { AuthModal, type AuthMode } from "@/components/auth/AuthModal";
import { UpvotePill } from "@/components/engagement/UpvotePill";
import { Wordmark } from "@/components/Wordmark";
import { OverflowMenu, OverflowItem } from "@/components/OverflowMenu";
import { ReportDialog } from "@/components/ReportDialog";
import { monogram } from "@/lib/cover";
import type { ThreadComment, ThreadSort } from "@/lib/db/queries/comments";
import type { Explanation } from "@/lib/schema";

function countAll(nodes: ThreadComment[]): number {
  return nodes.reduce((n, c) => n + 1 + c.replies.length, 0);
}

function relTime(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

function SparkGlyph({ className }: { className?: string }) {
  // Lucide-weight spark — the brand's rare-icon exception for the AI affordance (handoff §5).
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M8 2.5l1.3 3.2L12.5 7l-3.2 1.3L8 11.5 6.7 8.3 3.5 7l3.2-1.3z" />
    </svg>
  );
}

// "Explain this" fetch state (Order G8b). Signed-in only; re-tap collapses; result is cached
// server-side so a second open is instant.
type ExplainTarget = { commentId: string } | { productId: string };
function useExplain(target: ExplainTarget, signedIn: boolean, onNeedAuth: () => void) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [data, setData] = useState<Explanation | null>(null);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target),
      });
      if (!res.ok) throw new Error("explain failed");
      const j = await res.json();
      setData(j.explanation);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    if (open) return setOpen(false);
    if (!signedIn) return onNeedAuth();
    setOpen(true);
    if (!data) load();
  }

  return { open, loading, error, data, toggle, load };
}

export function CommentThread({
  productId,
  initial,
}: {
  productId: string;
  initial: ThreadComment[];
}) {
  const { available, user, profile, refresh } = useAuth();
  const [comments, setComments] = useState<ThreadComment[]>(initial);
  const [sort, setSort] = useState<ThreadSort>("top");
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  // Commenting/reporting need a REAL account (Order S2); "Explain this" stays open to guests.
  const verified = !!user && !user.isAnonymous;
  const openAuth = () => setAuthMode(user?.isAnonymous ? "upgrade" : "signin");

  async function reload(nextSort: ThreadSort = sort) {
    try {
      const res = await fetch(`/api/comments?productId=${productId}&sort=${nextSort}`);
      const data = await res.json();
      setComments(data.comments ?? []);
    } catch {
      /* keep what we have */
    }
  }

  function changeSort(next: ThreadSort) {
    setSort(next);
    reload(next);
  }

  const total = countAll(comments);

  return (
    <section className="mt-12 border-t border-line pt-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl text-ink">
          Discussion <span className="text-muted">· {total}</span>
        </h2>
        {total > 0 && (
          <div className="flex rounded-full bg-canvas p-0.5 text-[13px]" role="group" aria-label="Sort comments">
            {(["top", "newest"] as ThreadSort[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => changeSort(s)}
                aria-pressed={sort === s}
                className={`rounded-full px-3 py-1 font-medium transition ${
                  sort === s ? "bg-paper text-ink shadow-card" : "text-muted hover:text-ink"
                }`}
              >
                {s === "top" ? "Top" : "Newest"}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="mt-1.5 text-sm text-muted">
        Comments are opinions from the community. For a factual take, use{" "}
        <span className="text-ink/70">Explain this</span> on any comment.
      </p>

      {/* Composer */}
      <Composer
        available={available}
        signedIn={verified}
        profileName={profile?.displayName ?? profile?.handle ?? null}
        onNeedAuth={openAuth}
        onPost={async (text) => {
          const res = await fetch("/api/comments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId, body: text }),
          });
          if (res.ok) await reload();
          else if (res.status === 403) openAuth(); // guest → prompt an upgrade
          return res.ok;
        }}
      />

      {/* Thread */}
      {comments.length === 0 ? (
        <div className="mt-6 rounded-xl border border-line bg-paper p-6 text-center">
          <p className="text-sm text-ink">No comments yet.</p>
          <p className="mt-1 text-sm text-muted">Be the first to share what you think.</p>
          <ProductExplain
            productId={productId}
            signedIn={!!user}
            onNeedAuth={openAuth}
          />
        </div>
      ) : (
        <ul className="mt-6">
          {comments.map((c) => (
            <li key={c.id}>
              <CommentRow
                comment={c}
                productId={productId}
                signedIn={verified}
                onNeedAuth={openAuth}
                onChanged={reload}
              />
            </li>
          ))}
        </ul>
      )}

      {authMode && (
        <AuthModal
          mode={authMode}
          onClose={() => setAuthMode(null)}
          onDone={() => {
            setAuthMode(null);
            refresh();
          }}
        />
      )}
    </section>
  );
}

// ── Composer (collapses when empty, grows on focus) ──────────────────────────────────────────

function Composer({
  available,
  signedIn,
  profileName,
  onNeedAuth,
  onPost,
  placeholder = "Share what you think about this product…",
  compact = false,
  onCancel,
}: {
  available: boolean;
  signedIn: boolean;
  profileName: string | null;
  onNeedAuth: () => void;
  onPost: (text: string) => Promise<boolean>;
  placeholder?: string;
  compact?: boolean;
  onCancel?: () => void;
}) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(compact);
  const [busy, setBusy] = useState(false);
  if (!available) return null;

  const open = focused || text.length > 0;

  async function submit() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    const ok = await onPost(t);
    setBusy(false);
    if (ok) {
      setText("");
      setFocused(false);
      onCancel?.();
    }
  }

  return (
    <div className={compact ? "mt-3" : "mt-6"}>
      <div className="flex gap-3">
        {!compact && (
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas font-display text-sm text-ink/40"
          >
            {profileName ? monogram(profileName) : "?"}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <textarea
            value={text}
            onFocus={() => {
              if (!signedIn) onNeedAuth();
              else setFocused(true);
            }}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            rows={open ? 3 : 1}
            maxLength={1000}
            className="w-full resize-none rounded-lg border border-line bg-paper px-3.5 py-2.5 text-[15px] text-ink outline-none transition focus:border-natural focus:ring-2 focus:ring-natural/20"
          />
          {open && (
            <div className="mt-2 flex animate-fade-in items-center justify-between gap-3">
              <p className="text-xs text-muted">This reads as your opinion, not a fact.</p>
              <div className="flex items-center gap-2">
                {compact && (
                  <button
                    type="button"
                    onClick={() => {
                      setText("");
                      onCancel?.();
                    }}
                    className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-muted transition hover:text-ink"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy || text.trim().length === 0}
                  className="rounded-lg bg-ink px-4 py-1.5 text-[13px] font-medium text-paper transition hover:bg-ink/85 disabled:opacity-40"
                >
                  Post
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Comment row + one level of replies ───────────────────────────────────────────────────────

function CommentRow({
  comment,
  productId,
  signedIn,
  onNeedAuth,
  onChanged,
  isReply = false,
}: {
  comment: ThreadComment;
  productId: string;
  signedIn: boolean;
  onNeedAuth: () => void;
  onChanged: () => Promise<void>;
  isReply?: boolean;
}) {
  const { available, user, profile } = useAuth();
  const [replying, setReplying] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  // "Explain this" is open to any signed-in user incl. guests (server keeps it on requireUser);
  // reply/report require a real account via the `signedIn` (=verified) prop.
  const anySignedIn = !!user;
  const explain = useExplain({ commentId: comment.id }, anySignedIn, onNeedAuth);
  const isAuthor = !!user && user.id === comment.authorId;

  const avatarSize = isReply ? "h-7 w-7 text-[11px]" : "h-[34px] w-[34px] text-xs";

  // Tombstone: a removed comment keeps its slot (so replies aren't orphaned) but leaks nothing.
  if (comment.hidden) {
    return (
      <div className={isReply ? "py-3" : "border-b border-line py-4"}>
        <p className="text-sm italic text-muted">This comment was removed.</p>
        {comment.replies.length > 0 && (
          <ul className="mt-2 border-l border-line pl-4">
            {comment.replies.map((r) => (
              <li key={r.id}>
                <CommentRow comment={r} productId={productId} signedIn={signedIn} onNeedAuth={onNeedAuth} onChanged={onChanged} isReply />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className={isReply ? "py-3" : "border-b border-line py-4"}>
      <div className="flex gap-2.5">
        <span
          aria-hidden
          className={`flex shrink-0 items-center justify-center rounded-full bg-canvas font-display text-ink/40 ${avatarSize}`}
        >
          {monogram(comment.author.displayName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <Link href={profilePath(comment.author.handle)} className="font-semibold text-ink hover:underline">
              @{comment.author.handle}
            </Link>
            <time className="text-xs tabular-nums text-muted" dateTime={comment.ts}>
              {relTime(comment.ts)}
            </time>
            <span className="ml-auto">
              <OverflowMenu label="Comment actions">
                {(close) =>
                  isAuthor ? (
                    <OverflowItem
                      danger
                      onClick={async () => {
                        close();
                        if (!confirm("Delete this comment?")) return;
                        const res = await fetch(`/api/comments?id=${comment.id}`, { method: "DELETE" });
                        if (res.ok) await onChanged();
                      }}
                    >
                      Delete
                    </OverflowItem>
                  ) : (
                    <OverflowItem
                      onClick={() => {
                        close();
                        signedIn ? setReportOpen(true) : onNeedAuth();
                      }}
                    >
                      Report
                    </OverflowItem>
                  )
                }
              </OverflowMenu>
            </span>
          </div>
          <p className={`mt-1 whitespace-pre-wrap leading-relaxed text-ink/70 ${isReply ? "text-sm" : "text-[15px]"}`}>
            {comment.body}
          </p>

          <div className="mt-2 flex items-center gap-3">
            <UpvotePill
              targetType="comment"
              targetId={comment.id}
              initialCount={comment.votes}
              initialVoted={comment.viewerVoted}
              size={isReply ? "xs" : "sm"}
            />
            {!isReply && (
              <>
                <button
                  type="button"
                  onClick={() => (signedIn ? setReplying((v) => !v) : onNeedAuth())}
                  className="text-[13px] font-medium text-muted transition hover:text-ink"
                >
                  Reply
                </button>
                <button
                  type="button"
                  onClick={explain.toggle}
                  aria-pressed={explain.open}
                  className="flex items-center gap-1 text-[13px] font-medium text-muted transition hover:text-ink"
                >
                  <SparkGlyph className="h-3.5 w-3.5" />
                  Explain this
                </button>
              </>
            )}
          </div>

          {!isReply && explain.open && (
            <ExplainCard loading={explain.loading} error={explain.error} data={explain.data} onRetry={explain.load} />
          )}

          {replying && (
            <Composer
              available={available}
              signedIn={signedIn}
              profileName={profile?.displayName ?? null}
              compact
              placeholder="Write a reply…"
              onNeedAuth={onNeedAuth}
              onCancel={() => setReplying(false)}
              onPost={async (text) => {
                const res = await fetch("/api/comments", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ productId, body: text, parentId: comment.id }),
                });
                if (res.ok) await onChanged();
                else if (res.status === 403) onNeedAuth(); // guest → prompt an upgrade
                return res.ok;
              }}
            />
          )}

          {comment.replies.length > 0 && (
            <ul className="mt-2 border-l border-line pl-4">
              {comment.replies.map((r) => (
                <li key={r.id}>
                  <CommentRow
                    comment={r}
                    productId={productId}
                    signedIn={signedIn}
                    onNeedAuth={onNeedAuth}
                    onChanged={onChanged}
                    isReply
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {reportOpen && (
        <ReportDialog targetType="comment" targetId={comment.id} onClose={() => setReportOpen(false)} />
      )}
    </div>
  );
}

// ── The one card in a card-less thread: Baloo AI = neutral reference (handoff §5) ─────────────

function ExplainCard({
  loading,
  error,
  data,
  onRetry,
}: {
  loading: boolean;
  error: boolean;
  data: Explanation | null;
  onRetry: () => void;
}) {
  return (
    <div className="mt-3 animate-rise overflow-hidden rounded-xl border border-line bg-paper">
      {/* Header strip: wordmark, NOT an avatar — the strongest signal the speaker isn't a person. */}
      <div className="flex items-center gap-2 border-b border-line bg-canvas px-4 py-2.5">
        <SparkGlyph className="h-4 w-4 text-natural" />
        <Wordmark className="text-sm" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted">
          Explanation
        </span>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 px-4 py-4 text-sm text-muted">
          <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-natural" />
          Baloo is reading the label…
        </p>
      ) : error ? (
        <div className="px-4 py-4">
          <p className="text-sm text-ink">Baloo couldn&apos;t generate an explanation right now.</p>
          <button type="button" onClick={onRetry} className="mt-2 text-[13px] font-medium text-natural hover:underline">
            Try again
          </button>
        </div>
      ) : data ? (
        <div className="px-4 py-4">
          <p className="text-[15px] leading-relaxed text-ink/80">
            <span className="font-semibold text-ink">What it is. </span>
            {data.what_it_is}
          </p>
          {data.in_this_product && (
            <p className="mt-3 text-[15px] leading-relaxed text-ink/80">
              <span className="font-semibold text-ink">In this product. </span>
              {data.in_this_product}
            </p>
          )}
          <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
            Generated by Baloo from the product label. A factual explanation, not a health claim or
            an opinion.
          </p>
        </div>
      ) : null}
    </div>
  );
}

// Product-scope Explain (empty-state variant, handoff §5): the AI is reachable before any
// discussion exists.
function ProductExplain({
  productId,
  signedIn,
  onNeedAuth,
}: {
  productId: string;
  signedIn: boolean;
  onNeedAuth: () => void;
}) {
  const explain = useExplain({ productId }, signedIn, onNeedAuth);
  return (
    <div className="mt-4">
      <div className="flex justify-center">
        <button
          type="button"
          onClick={explain.toggle}
          aria-pressed={explain.open}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-4 py-1.5 text-[13px] font-medium text-ink transition hover:bg-canvas"
        >
          <SparkGlyph className="h-3.5 w-3.5 text-natural" />
          Explain the ingredients
        </button>
      </div>
      {explain.open && (
        <div className="mx-auto mt-3 max-w-md text-left">
          <ExplainCard loading={explain.loading} error={explain.error} data={explain.data} onRetry={explain.load} />
        </div>
      )}
    </div>
  );
}
