"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n/context";
import { i18nEnabled, stripLocale, localizePath, locales } from "@/lib/i18n/config";

// EN / ES toggle. Localized URLs (English at root, Spanish under /es), so switching NAVIGATES to the
// same page in the other locale — Google indexes both. Hidden entirely until i18n is enabled (the
// public Spanish experience waits on Spanish engine content).
export function LocaleToggle() {
  const locale = useLocale();
  const pathname = usePathname() ?? "/";
  if (!i18nEnabled()) return null;

  const bare = stripLocale(pathname);

  return (
    <div className="flex items-center rounded-full bg-line/40 p-0.5 text-[12px] font-semibold" role="group" aria-label="Language / Idioma">
      {locales.map((l) => (
        <Link
          key={l}
          href={localizePath(bare, l)}
          hrefLang={l}
          aria-current={locale === l ? "true" : undefined}
          className={`rounded-full px-2 py-0.5 transition ${
            locale === l ? "bg-paper text-ink shadow-card" : "text-muted hover:text-ink"
          }`}
        >
          {l.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}
