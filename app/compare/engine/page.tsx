import type { Metadata } from "next";
import { EngineCompare } from "@/components/compare/EngineCompare";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";

// Internal engine-compare page (feat/engine-compare): our stored analysis vs the recognition engine's
// output, side by side, for a chosen catalog product. The "compare off vs on" the team wanted before
// the flagged swap. Not linked from nav; noindex so it never surfaces publicly.
export const metadata: Metadata = {
  title: "Engine compare — Baloo (internal)",
  robots: { index: false, follow: false },
};

export default function EngineComparePage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <SiteHeader variant="left" />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5">
        <section className="pt-12 sm:pt-16">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Internal tool</p>
            <h1 className="mt-2 font-display text-[40px] leading-[1.08] tracking-[-0.01em] text-ink sm:text-[54px]">
              Ours vs the engine
            </h1>
            <p className="mt-4 text-[17px] leading-relaxed text-muted">
              Pick a catalog product and see our current analysis next to the recognition engine&apos;s
              output, mapped into our shapes — ingredients, nutrition, and the summary sentence. For
              judging quality, tone, and the tag/naming differences before we wire the swap in.
            </p>
          </div>

          <div className="mt-7">
            <EngineCompare />
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
