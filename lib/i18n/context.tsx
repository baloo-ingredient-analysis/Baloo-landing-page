"use client";

// Client-side locale context. The root layout (server) resolves the locale and wraps the app in
// <LocaleProvider locale=…>; client components read strings with useT() and the active locale with
// useLocale(). The dictionary is derived from the locale here (it's small + bundled), so only the
// locale crosses the server→client boundary.

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "./config";
import { getDictionary, type Dictionary } from "./dictionaries";

type LocaleValue = { locale: Locale; t: Dictionary };
const LocaleContext = createContext<LocaleValue>({ locale: "en", t: getDictionary("en") });

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo<LocaleValue>(() => ({ locale, t: getDictionary(locale) }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

export function useT(): Dictionary {
  return useContext(LocaleContext).t;
}
