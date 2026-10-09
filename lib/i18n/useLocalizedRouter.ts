"use client";

// Locale-aware router (Languages track, slice 2). Wraps next/navigation's useRouter so push/replace/
// prefetch keep the current locale (an internal "/p/foo" becomes "/es/p/foo" in a Spanish session).
// back/forward/refresh pass straight through. No-op when i18n is disabled — locale is "en", so
// localizePath returns the bare path. Use this instead of useRouter for app navigation that should
// stay in the viewer's language.

import { useRouter } from "next/navigation";
import { useLocale } from "./context";
import { localizePath } from "./config";

type NavOptions = Parameters<ReturnType<typeof useRouter>["push"]>[1];

export function useLocalizedRouter() {
  const router = useRouter();
  const locale = useLocale();
  const loc = (url: string) =>
    url.startsWith("/") && !url.startsWith("//") ? localizePath(url, locale) : url;

  return {
    push: (url: string, options?: NavOptions) => router.push(loc(url), options),
    replace: (url: string, options?: NavOptions) => router.replace(loc(url), options),
    prefetch: (url: string) => router.prefetch(loc(url)),
    back: () => router.back(),
    forward: () => router.forward(),
    refresh: () => router.refresh(),
  };
}
