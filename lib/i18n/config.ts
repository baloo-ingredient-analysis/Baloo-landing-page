// i18n config (Languages track). English lives at the root (/), Spanish under /es — localized URL
// paths so Google indexes both (the SEO-correct approach for a Spain-first launch). The toggle just
// navigates between the two.
//
// GATED: the public Spanish experience (the /es routing + the toggle) only turns on when the engine
// can serve Spanish ingredient content — until then we'd be wrapping English analysis in a Spanish
// shell. Flip NEXT_PUBLIC_I18N_ENABLED=1 to turn it on. Off → English-only, no /es, no toggle.

export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export function isLocale(x: string | null | undefined): x is Locale {
  return x === "en" || x === "es";
}

export function i18nEnabled(): boolean {
  return process.env.NEXT_PUBLIC_I18N_ENABLED === "1";
}

// Build the URL for a path in a given locale. English keeps the bare path; Spanish gets the /es prefix.
export function localizePath(path: string, locale: Locale): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale !== "es") return clean;
  return clean === "/" ? "/es" : `/es${clean}`;
}

// Strip a leading /es from a path → the bare (English) path. Safe on already-bare paths.
export function stripLocale(path: string): string {
  if (path === "/es") return "/";
  if (path.startsWith("/es/")) return path.slice(3);
  return path;
}
