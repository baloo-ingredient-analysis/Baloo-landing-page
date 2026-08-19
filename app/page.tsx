"use client";

import { Suspense, useEffect, useState } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { analysisSchema, type Ingredient, type Nutrition } from "@/lib/schema";
import Link from "next/link";
import { SearchBox } from "@/components/discover/SearchBox";
import { LoadingState } from "@/components/LoadingState";
import { ResultsView } from "@/components/ResultsView";
import { EmailCapture } from "@/components/EmailCapture";
import { PopularLists } from "@/components/PopularLists";
import { HowItWorks } from "@/components/HowItWorks";
import { Board } from "@/components/Board";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";

const FRIENDLY_ERROR =
  "We couldn't read that page. Some store pages block automated reading, or don't list ingredients — try a different product, or a link from another store.";

type Phase = "idle" | "reading" | "analyzing" | "done" | "error";
type Header = {
  product_name: string;
  retailer: string;
  url: string;
  count: number;
  nutrition?: Nutrition;
  key?: string;
  product_summary?: string;
};

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [header, setHeader] = useState<Header | null>(null);
  const [cached, setCached] = useState<Ingredient[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Return to the idle home (the search screen). Used by the "New search" button after a link paste.
  function handleReset() {
    setHeader(null);
    setCached(null);
    setErrorMsg(null);
    setPhase("idle");
  }

  const { object, submit, isLoading, error } = useObject({
    api: "/api/analyze",
    schema: analysisSchema,
  });

  async function handleAnalyze(url: string) {
    setHeader(null);
    setCached(null);
    setErrorMsg(null);
    setPhase("reading");

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        if (data.error === "missing_keys") {
          setErrorMsg("The analyser isn't configured yet — add API keys to .env.local.");
        } else {
          setErrorMsg(FRIENDLY_ERROR);
        }
        setPhase("error");
        return;
      }

      if (data.cached) {
        setHeader({
          product_name: data.product_name,
          retailer: data.retailer,
          url: data.url,
          count: data.ingredients.length,
          nutrition: data.nutrition,
          key: data.key,
          product_summary: data.product_summary,
        });
        setCached(data.ingredients);
        setPhase("done");
        return;
      }

      setHeader({
        product_name: data.product_name,
        retailer: data.retailer,
        url: data.url,
        count: data.ingredients_list.length,
        nutrition: data.nutrition,
        key: data.key,
      });
      setPhase("analyzing");
      submit({
        product_name: data.product_name,
        retailer: data.retailer,
        ingredients_list: data.ingredients_list,
        percentages: data.percentages,
        nutrition: data.nutrition,
        key: data.key,
        url: data.url,
      });
    } catch {
      setErrorMsg(FRIENDLY_ERROR);
      setPhase("error");
    }
  }

  // App-shell search hand-off (Order L1d-2): the header overlay routes a pasted URL to `/?url=…`.
  // Read it once on mount, strip it so a refresh doesn't re-analyse, and run the normal flow.
  useEffect(() => {
    const url = new URLSearchParams(window.location.search).get("url");
    if (!url) return;
    window.history.replaceState(null, "", "/");
    handleAnalyze(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const streamed = (object?.ingredients ?? []) as Partial<Ingredient>[];
  const ingredients = cached ?? streamed;
  const idle = phase === "idle";
  const analysing = phase === "analyzing" && isLoading;
  const streamError = Boolean(error) && phase === "analyzing";
  const hasHeader = Boolean(header) && !errorMsg && !streamError;
  const showResults = hasHeader && (ingredients.length > 0 || analysing);
  const showEmail = hasHeader && ingredients.length > 0 && !analysing;

  return (
    <div className="relative flex min-h-screen flex-col">
      <SiteHeader variant="left" />
      <main className="mx-auto flex w-full max-w-tool flex-1 flex-col px-5">
        <section className={idle ? "pt-12 sm:pt-16" : "pt-8"}>
          {idle ? (
            <>
              <div className="max-w-xl">
                <h1 className="font-display text-[40px] leading-[1.08] tracking-[-0.01em] text-ink sm:text-[54px]">
                  Know what&rsquo;s in <em className="text-natural">your</em> food.
                </h1>
                <p className="mt-5 max-w-md text-[17px] leading-relaxed text-muted">
                  Search any product for a calm, plain-language breakdown of every ingredient — what
                  it is, and why it&rsquo;s there.
                </p>
              </div>

              {/* The search engine IS the home screen. useSearchParams needs a Suspense boundary. */}
              <div className="mt-7 max-w-xl">
                <Suspense fallback={null}>
                  <SearchBox basePath="/" />
                </Suspense>
              </div>

              <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                <Link
                  href="/p/oatly-oat-drink-barista-edition"
                  className="font-medium text-natural hover:underline"
                >
                  See a sample analysis →
                </Link>
                <span className="text-muted">Free &middot; No sign-up &middot; No score, ever</span>
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 py-1.5 text-sm font-medium text-ink shadow-card transition hover:border-natural/50 hover:text-natural focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-natural/10"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 18l-6-6 6-6" />
              </svg>
              New search
            </button>
          )}
        </section>

        {idle && <PopularLists />}
        {idle && <HowItWorks />}
        {idle && <Board />}

        {phase === "reading" && <LoadingState phase="reading" />}

        {(errorMsg || streamError) && (
          <div className="mt-12 rounded-2xl border border-line bg-paper p-6 text-center shadow-card animate-fade-in">
            <p className="text-ink">{errorMsg ?? FRIENDLY_ERROR}</p>
            <p className="mt-1 text-sm text-muted">Use New search above, or search for the product by name.</p>
          </div>
        )}

        {showResults && (
          <ResultsView
            productName={header!.product_name}
            retailer={header!.retailer}
            sourceUrl={header!.url}
            count={header!.count}
            ingredients={ingredients}
            nutrition={header!.nutrition}
            cacheKey={header!.key}
            productSummary={header!.product_summary ?? (object?.product_summary as string | undefined)}
            loading={analysing}
          />
        )}

        {showEmail && <EmailCapture />}

        <Footer />
      </main>
    </div>
  );
}
