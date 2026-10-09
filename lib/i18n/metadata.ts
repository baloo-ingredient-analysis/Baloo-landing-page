// hreflang / canonical alternates for page metadata (Languages track, slice 2). Builds the
// `alternates` block Next.js turns into <link rel="canonical"> + <link rel="alternate" hreflang=…>.
//
// Per Google's guidance each language version carries a SELF-referencing canonical and the full
// hreflang set names every alternate, so the right language is served in each market.
//
// GATED: with NEXT_PUBLIC_I18N_ENABLED off we emit only the bare canonical — exactly today's output —
// so prod is unchanged until Spanish turns on. We never advertise an /es URL that isn't routed yet.

import type { Metadata } from "next";
import { getLocale } from "./server";
import { i18nEnabled, localizePath } from "./config";

export async function localeAlternates(path: string): Promise<NonNullable<Metadata["alternates"]>> {
  const en = path;
  if (!i18nEnabled()) return { canonical: en };
  const es = localizePath(path, "es");
  const locale = await getLocale();
  return {
    canonical: locale === "es" ? es : en,
    languages: { en, es, "x-default": en },
  };
}
