"use client";

// In-app notifications bell (N1). Load-time fetch (no polling): an unread badge over the existing
// engagement tables — new followers, and likes/saves on your lists. Opening the panel marks all seen
// (clears the badge via /api/notifications/seen). Renders nothing for signed-out visitors, and stays
// invisible until it actually has something (an empty, badge-less bell would just be chrome).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "../auth/useAuth";

type NotificationActor = { handle: string; displayName: string };
type Notification =
  | { kind: "followed"; ts: string; actor: NotificationActor }
  | { kind: "liked_list" | "saved_list"; ts: string; actor: NotificationActor; list: { title: string; slug: string } };

export function NotificationBell() {
  const { available, user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Fetch once the viewer is known. 401 (signed-out) → stays empty and the bell hides itself.
  useEffect(() => {
    if (!available || !user) return;
    let live = true;
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : { notifications: [], unread: 0 }))
      .then((d) => {
        if (!live) return;
        setItems(d.notifications ?? []);
        setUnread(d.unread ?? 0);
        setLoaded(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [available, user]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Signed-out or still loading → no bell. Once loaded it's always shown for a signed-in user (the
  // standard affordance — the panel carries its own empty state), so it never mysteriously vanishes.
  if (!available || !user || !loaded) return null;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0); // optimistic
      fetch("/api/notifications/seen", { method: "POST" }).catch(() => {});
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-paper hover:text-ink"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-[18px] w-[18px]">
          <path d="M10 3a4 4 0 0 0-4 4c0 4-1.5 5-1.5 5h11S14 11 14 7a4 4 0 0 0-4-4Z" />
          <path d="M8.5 15.5a1.5 1.5 0 0 0 3 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 min-w-[15px] rounded-full bg-processed px-1 text-center text-[11px] font-semibold leading-[15px] text-paper">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-paper shadow-hero">
          <p className="border-b border-line px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Notifications
          </p>
          {items.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted">
              You&apos;re all caught up. Follows and likes on your lists show up here.
            </p>
          )}
          <ul className="max-h-[60vh] overflow-y-auto [&>li+li]:border-t [&>li+li]:border-line">
            {items.map((n, i) => {
              const href = n.kind === "followed" ? `/u/${n.actor.handle}` : `/list/${n.list.slug}`;
              return (
                <li key={`${n.kind}-${i}-${n.ts}`}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 transition hover:bg-canvas"
                  >
                    <span className="text-sm text-ink">
                      <span className="font-medium">@{n.actor.handle}</span>{" "}
                      {n.kind === "followed" ? (
                        "followed you"
                      ) : (
                        <>
                          {n.kind === "liked_list" ? "liked" : "saved"}{" "}
                          <span className="text-ink">{n.list.title}</span>
                        </>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">{timeAgo(n.ts)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(iso).toLocaleDateString();
}
