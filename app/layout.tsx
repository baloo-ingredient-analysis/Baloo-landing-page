import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
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
  title: "Baloo — Know what's in your food",
  description:
    "Search any food product and see what every ingredient is, and why it's there. Calm, plain language, no score.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
