import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import { Wordmark } from "./Wordmark";
import { AccountMenu } from "./auth/AccountMenu";
import { HeaderNav } from "./HeaderNav";
import { HeaderSearch } from "./HeaderSearch";
import { LocaleToggle } from "./LocaleToggle";
import { NotificationBell } from "./notifications/NotificationBell";

// The shared app-shell header (Orders G5 + L1d). One component instead of seven hand-copied headers.
//
// variant "left" (Order L1d): the V3 app shell — a full-width, sticky, blur bar that spans the
// viewport, with its inner content constrained to the page's column (`width`) so the wordmark/nav
// stay aligned with what's below. Rendered as a SIBLING above each page's <main>, not inside it, so
// the bar can go edge-to-edge. `action` is the page-specific control slot (Edit / Done / Add to list),
// before the account menu; `HeaderNav` marks the active section.
//
// variant "center": the welcome/onboarding hero header — centered wordmark, non-sticky, deliberately
// outside the shell (a focused screen). Unchanged.
export function SiteHeader({
  variant = "left",
  action,
  showNav = true,
  width = "tool",
}: {
  variant?: "left" | "center";
  action?: React.ReactNode;
  showNav?: boolean;
  width?: "tool" | "wide";
}) {
  if (variant === "center") {
    return (
      <header className="relative flex items-center justify-center pt-8 sm:pt-10">
        <LocalizedLink href="/" aria-label="Baloo home">
          <Wordmark className="text-xl" />
        </LocalizedLink>
        <div className="absolute right-0">
          <AccountMenu />
        </div>
      </header>
    );
  }

  const inner = width === "wide" ? "max-w-[1140px]" : "max-w-tool";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-line/70 bg-canvas/75 backdrop-blur-md">
      <div className={`mx-auto flex h-14 items-center justify-between gap-3 px-5 ${inner}`}>
        <LocalizedLink href="/" aria-label="Baloo home">
          <Wordmark className="text-xl" />
        </LocalizedLink>
        <div className="flex items-center gap-3">
          {showNav && <HeaderNav className="hidden sm:flex" />}
          <HeaderSearch />
          <LocaleToggle />
          {action}
          <NotificationBell />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
