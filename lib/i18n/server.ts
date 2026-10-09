import { headers } from "next/headers";
import { defaultLocale, isLocale, type Locale } from "./config";
import { getDictionary } from "./dictionaries";

// Locale for the current request. Middleware sets `x-locale` from the URL (/es → es); default en.
// Server components call this; client components read the LocaleProvider context instead.
export async function getLocale(): Promise<Locale> {
  const h = await headers();
  const v = h.get("x-locale");
  return isLocale(v) ? v : defaultLocale;
}

export async function getServerDictionary() {
  return getDictionary(await getLocale());
}
