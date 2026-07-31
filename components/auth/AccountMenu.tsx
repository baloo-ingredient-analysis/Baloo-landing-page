"use client";

// Header account control (Order G2). Renders NOTHING when Supabase isn't configured — the site
// behaves exactly as pre-G2. Dropdown interaction mirrors ProfileSelector's pattern.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useAuth } from "./useAuth";
import { AuthModal, type AuthMode } from "./AuthModal";

export function AccountMenu() {
  const { loading, available, user, profile, refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<AuthMode | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

  if (!available || loading) return null;

  async function signOut() {
    setOpen(false);
    await supabaseBrowser()?.auth.signOut();
    refresh();
  }

  function done() {
    setModal(null);
    refresh();
    router.push("/welcome"); // /welcome bounces straight home when the handle already exists
  }

  const label = user
    ? user.isAnonymous
      ? "Guest"
      : profile?.handle
        ? `@${profile.handle}`
        : "Finish setup"
    : "Sign in";

  // Clicking your handle goes to your PROFILE (same target as the Lists nav) — not a dropdown. A caret
  // beside it opens the account menu (Settings / Sign out). Guests / handle-pending / signed-out keep
  // the single button (they have no profile page to link to).
  const hasProfile = !!(user && profile?.handle);
  const profileHref = profile?.handle ? `/u/${profile.handle}?tab=lists` : "/";

  return (
    <div ref={rootRef} className="relative">
      {hasProfile ? (
        <div className="flex items-center overflow-hidden rounded-full border border-line bg-paper text-[13px] font-medium text-ink">
          <Link
            href={profileHref}
            onClick={() => setOpen(false)}
            className="max-w-[120px] truncate py-1.5 pl-3.5 pr-2 transition hover:bg-canvas"
          >
            @{profile!.handle}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Account menu"
            className="flex items-center border-l border-line px-2 py-1.5 text-muted transition hover:bg-canvas hover:text-ink"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            >
              <path d="M3.5 6l4.5 4.5L12.5 6" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => (user ? setOpen((o) => !o) : setModal("signin"))}
          aria-haspopup={user ? "menu" : undefined}
          aria-expanded={user ? open : undefined}
          className="max-w-[130px] truncate rounded-full border border-line bg-paper px-3.5 py-1.5 text-[13px] font-medium text-ink transition hover:border-ink/20"
        >
          {label}
        </button>
      )}

      {open && user && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-2 min-w-[210px] rounded-xl border border-line bg-paper p-1.5 shadow-hero"
        >
          {user.isAnonymous && (
            <MenuItem
              onClick={() => {
                setOpen(false);
                setModal("upgrade");
              }}
              label="Save your account"
              detail="Keep your lists — add an email."
            />
          )}
          {!user.isAnonymous && !profile && (
            <MenuItem
              onClick={() => {
                setOpen(false);
                router.push("/welcome");
              }}
              label="Choose your handle"
              detail="Finish setting up your profile."
            />
          )}
          <MenuItem
            onClick={() => {
              setOpen(false);
              router.push("/settings");
            }}
            label="Settings"
            detail="Account and data."
          />
          <MenuItem onClick={signOut} label="Sign out" detail={user.email ?? undefined} />
        </div>
      )}

      {modal && <AuthModal mode={modal} onClose={() => setModal(null)} onDone={done} />}
    </div>
  );
}

function MenuItem({
  onClick,
  label,
  detail,
}: {
  onClick: () => void;
  label: string;
  detail?: string;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="w-full rounded-lg px-2.5 py-2 text-left transition hover:bg-canvas"
    >
      <span className="block text-sm font-medium text-ink">{label}</span>
      {detail && <span className="block truncate text-xs text-muted">{detail}</span>}
    </button>
  );
}
