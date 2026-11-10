import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";

// Demo landing page (not linked from the app). The live product keeps "the homepage IS the tool";
// this is a separate marketing page to explore a dedicated landing, per Jitain's ask. Noindex so it
// never competes with the real homepage. SSR'd so the content is in the HTML immediately (no blank
// spinner); the motion enhances it on the client.
export const metadata: Metadata = {
  title: "Baloo — Know what's in your food",
  description:
    "Paste any supermarket product and Baloo explains every ingredient in plain language: what it is, and why it's there. No score, ever.",
  robots: { index: false, follow: false },
};

export default function LandingPage() {
  return <Landing />;
}
