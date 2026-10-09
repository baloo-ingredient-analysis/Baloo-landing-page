import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { siteUrl } from "@/lib/config";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/context";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Playfair Display (V3, Order L1a): the warm-boutique serif for the display role — editorial and
// calm, matching Baloo's "education over alarm" voice rather than a clinical health app. Same
// --font-display variable, so every font-display usage inherits the swap.
const display = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute base for every relative URL in metadata (canonical tags + OG/Twitter images). Without
  // it Next resolves those against localhost — so setting it once here fixes canonicals AND social
  // card images site-wide. Follows the domain via siteUrl() (lib/config.ts).
  metadataBase: new URL(siteUrl()),
  title: "Baloo — Know what's in your food",
  description:
    "Search any food product and see what every ingredient is, and why it's there. Calm, plain language, no score.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Locale from the request (middleware sets it from the URL: /es → es). Drives <html lang> and the
  // client LocaleProvider that every "use client" component reads strings from.
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${sans.variable} ${display.variable}`}>
      {/* Vercel Web Analytics (cookieless, no PII — fits Baloo's privacy posture). Same-origin only
          (/_vercel/insights/*), so the enforcing CSP needs no change. */}
      <body className="font-sans">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
        <Analytics />
      </body>
    </html>
  );
}
