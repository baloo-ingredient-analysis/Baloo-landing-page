import type { Metadata } from "next";
import { OffCompare } from "@/components/discover/OffCompare";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";

// Internal comparison page (feat/off-compare, per Jitain): filtered pipeline vs raw Open Food Facts,
// same query, side by side — to judge how messy OFF's raw data is and whether we should source from
// elsewhere. Not linked from the main nav; noindex so it never surfaces publicly.
export const metadata: Metadata = {
  title: "OFF compare — Baloo (internal)",
  robots: { index: false, follow: false },
};

export default function ComparePage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <SiteHeader variant="left" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5">
        <section className="pt-12 sm:pt-16">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Internal tool</p>
            <h1 className="mt-2 font-display text-[40px] leading-[1.08] tracking-[-0.01em] text-ink sm:text-[54px]">
              Filtered vs raw
            </h1>
            <p className="mt-4 text-[17px] leading-relaxed text-muted">
              One search, two results. Left is our filtered pipeline (what users see); right is the raw
              Open Food Facts response — no quality gate, no dedup, no country. So we can see the mess.
            </p>
          </div>

          <div className="mt-7">
            <OffCompare />
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
