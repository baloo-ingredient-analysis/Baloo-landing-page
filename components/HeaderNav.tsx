"use client";

// The app-shell section nav (Order L1d → PP4). The three sections are now curated line-icons, not
// text pills: the word appears in a small tooltip on hover/focus, and each link keeps an always-present
// `aria-label` + `aria-current` so screen readers and keyboard users never lose the name. "Lists" now
// points at the owner's profile Lists tab (Pinterest-style); it falls back to /lists when signed out.
// Client because it reads usePathname() for the active state and useAuth() for the handle + admin gate.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/useAuth";
import { profilePath } from "@/lib/profilePath";
import { useLocale, useT } from "@/lib/i18n/context";
import { localizePath } from "@/lib/i18n/config";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

// Following — two people (who you follow).
function FollowingIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="h-[18px] w-[18px]" {...stroke}>
      <circle cx="7.5" cy="7" r="3" />
      <path d="M2.5 16.5c0-2.6 2.2-4.5 5-4.5s5 1.9 5 4.5" />
      <path d="M13.5 4.3a3 3 0 0 1 0 5.4" />
      <path d="M15 12.2c1.8.5 2.9 1.9 2.9 4.3" />
    </svg>
  );
}

// Discover — a compass.
function DiscoverIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="h-[18px] w-[18px]" {...stroke}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M13.4 6.6 11.4 11.4 6.6 13.4 8.6 8.6z" />
    </svg>
  );
}

// Lists — a 2×2 grid of boards.
function ListsIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="h-[18px] w-[18px]" {...stroke}>
      <rect x="3" y="3" width="6" height="6" rx="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1.5" />
      <rect x="11" y="11" width="6" height="6" rx="1.5" />
    </svg>
  );
}

// Admin — a shield.
function AdminIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="h-[18px] w-[18px]" {...stroke}>
      <path d="M10 2.5 4 4.8v4.4c0 3.7 2.5 6 6 8 3.5-2 6-4.3 6-8V4.8z" />
    </svg>
  );
}

export function HeaderNav({ className = "" }: { className?: string }) {
  const pathname = usePathname() ?? "";
  const { profile } = useAuth();
  const t = useT();
  const locale = useLocale();
  const listsHref = profile?.handle ? profilePath(profile.handle, "lists") : "/lists";

  // Locale-aware hrefs: in Spanish, links carry the /es prefix (localizePath). The rest of the app's
  // links get the same treatment slice by slice.
  const items = [
    { href: localizePath("/feed", locale), label: t.nav.following, icon: <FollowingIcon /> },
    { href: localizePath("/discover", locale), label: t.nav.discover, icon: <DiscoverIcon /> },
    { href: localizePath(listsHref, locale), label: t.nav.lists, icon: <ListsIcon /> },
    ...(profile?.isAdmin
      ? [{ href: localizePath("/admin", locale), label: t.nav.admin, icon: <AdminIcon /> }]
      : []),
  ];

  const isActive = (href: string) => {
    const base = href.split("?")[0];
    return pathname === base || pathname.startsWith(base + "/");
  };

  return (
    <nav className={`items-center gap-1 ${className}`} aria-label="Site">
      {items.map((it) => {
        const active = isActive(it.href);
        return (
          <Link
            key={it.label}
            href={it.href}
            aria-label={it.label}
            aria-current={active ? "page" : undefined}
            className={`group relative flex h-9 w-9 items-center justify-center rounded-full transition ${
              active ? "bg-line/60 text-ink" : "text-muted hover:bg-line/40 hover:text-ink"
            }`}
          >
            {it.icon}
            <span
              aria-hidden
              className="pointer-events-none absolute top-full z-10 mt-1 whitespace-nowrap rounded-md bg-ink px-2 py-0.5 text-[11px] font-medium text-paper opacity-0 shadow-card transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              {it.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
