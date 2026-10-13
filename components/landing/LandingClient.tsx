"use client";

// Loads the animated landing client-only (no SSR). This is a noindex demo, so skipping SSR costs
// nothing for search and removes the Motion + prefers-reduced-motion hydration mismatch at the root.
// A brief branded spinner covers the bundle load, then the full page animates in.

import dynamic from "next/dynamic";

const Landing = dynamic(() => import("./Landing").then((m) => m.Landing), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[100dvh] items-center justify-center bg-canvas">
      <span
        aria-hidden
        className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-natural"
      />
    </div>
  ),
});

export default function LandingClient() {
  return <Landing />;
}
