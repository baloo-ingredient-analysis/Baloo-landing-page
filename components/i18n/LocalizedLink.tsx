"use client";

// Locale-aware <Link> (Languages track, slice 2). A drop-in for next/link that keeps the current
// locale: an internal href ("/p/foo") picks up the /es prefix in a Spanish session. External, hash,
// mailto/tel and protocol-relative ("//") hrefs, and non-string UrlObject hrefs, pass through
// untouched. No-op when i18n is disabled — the locale is always "en", so localizePath returns the
// bare path and this behaves exactly like <Link>.

import Link from "next/link";
import { forwardRef } from "react";
import { useLocale } from "@/lib/i18n/context";
import { localizePath } from "@/lib/i18n/config";

type LinkProps = React.ComponentProps<typeof Link>;

export const LocalizedLink = forwardRef<HTMLAnchorElement, LinkProps>(function LocalizedLink(
  { href, ...rest },
  ref,
) {
  const locale = useLocale();
  const localized =
    typeof href === "string" && href.startsWith("/") && !href.startsWith("//")
      ? localizePath(href, locale)
      : href;
  return <Link ref={ref} href={localized} {...rest} />;
});
