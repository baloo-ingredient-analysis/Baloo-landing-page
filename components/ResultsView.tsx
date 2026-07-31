"use client";

import { useState } from "react";
import type { Ingredient, Nutrition } from "@/lib/schema";
import { IngredientRow } from "./IngredientCard";
import { NutritionPanel } from "./NutritionPanel";

type Tab = "ingredients" | "nutrition";

export function ResultsView({
  productName,
  retailer,
  sourceUrl,
  count,
  ingredients,
  nutrition,
  cacheKey,
  productSummary,
  loading = false,
  actions,
}: {
  productName: string;
  retailer: string;
  sourceUrl: string;
  count: number;
  ingredients: Partial<Ingredient>[];
  nutrition?: Nutrition;
  cacheKey?: string;
  productSummary?: string;
  loading?: boolean;
  actions?: React.ReactNode; // product-page actions (Save to pantry, Add to my list) under the title
}) {
  const [tab, setTab] = useState<Tab>("ingredients");
  const empty = ingredients.length === 0;

  const tabClass = (active: boolean) =>
    `-mb-px border-b-2 py-3 text-[15px] transition ${
      active
        ? "border-natural font-semibold text-ink"
        : "border-transparent font-medium text-muted hover:text-ink"
    }`;

  return (
    <section className="mt-12 animate-fade-in">
      <header className="border-b border-line pb-5">
        <p className="text-sm text-muted">
          {retailer}
          {sourceUrl && (
            <>
              {" · "}
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-line underline-offset-2 transition hover:text-ink"
              >
                View on retailer
              </a>
            </>
          )}
        </p>
        <h2 className="mt-1.5 font-display text-2xl leading-tight text-ink sm:text-3xl">
          {productName}
        </h2>
        {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
      </header>

      {/* Tabs per the design handoff: Ingredients / Nutrition / Processing (Soon, disabled). */}
      <div role="tablist" aria-label="Result views" className="mt-1.5 flex gap-6 border-b border-line">
        <button
          role="tab"
          id="tab-ingredients"
          aria-controls="panel-ingredients"
          aria-selected={tab === "ingredients"}
          onClick={() => setTab("ingredients")}
          className={tabClass(tab === "ingredients")}
        >
          Ingredients
        </button>
        <button
          role="tab"
          id="tab-nutrition"
          aria-controls="panel-nutrition"
          aria-selected={tab === "nutrition"}
          onClick={() => setTab("nutrition")}
          className={tabClass(tab === "nutrition")}
        >
          Nutrition
        </button>
        <button
          role="tab"
          aria-selected={false}
          disabled
          aria-disabled
          className="-mb-px flex cursor-not-allowed items-center gap-1.5 border-b-2 border-transparent py-3 text-[15px] font-medium text-muted opacity-50"
        >
          Processing
          <span className="rounded-full bg-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted">
            Soon
          </span>
        </button>
      </div>

      {/* Both panels stay mounted (inactive one hidden) so streaming keeps flowing into the
          Ingredients list while the user reads Nutrition, and row animations don't replay. */}
      <div
        id="panel-ingredients"
        role="tabpanel"
        aria-labelledby="tab-ingredients"
        hidden={tab !== "ingredients"}
      >
        {empty ? (
          <div className="mt-8 flex items-center gap-3 text-muted">
            <Spinner />
            <span className="text-sm">Analysing the first ingredients…</span>
          </div>
        ) : (
          <>
            <CountLede
              count={count}
              ingredients={ingredients}
              summary={productSummary}
              loading={loading}
            />

            {/* One container, not one card per ingredient — an index, not a stack. */}
            <ul className="mt-4 overflow-hidden rounded-2xl border border-line bg-paper shadow-card [&>li+li]:border-t [&>li+li]:border-line">
              {ingredients.map((ing, i) => (
                <IngredientRow key={i} ingredient={ing} index={i} />
              ))}
              {loading && (
                <li className="flex list-none items-center gap-3 border-t border-line px-4 py-3.5 text-muted sm:px-5">
                  <Spinner />
                  <span className="text-sm">Analysing the rest…</span>
                </li>
              )}
            </ul>
          </>
        )}
      </div>
      <div
        id="panel-nutrition"
        role="tabpanel"
        aria-labelledby="tab-nutrition"
        hidden={tab !== "nutrition"}
      >
        <NutritionPanel nutrition={nutrition} productName={productName} cacheKey={cacheKey} />
      </div>
    </section>
  );
}

// The striking count lede (Order L1c, V3) — the number is the hero of the analysis view: it should
// "feel striking, or give a sensation that it's clean" (Jitain). `count` is the total from extract,
// known up-front so the big number is there immediately even mid-stream; natural/processed grow as
// tags stream in. Counts are computed HERE in code; the model never counts (CLAUDE.md).
function CountLede({
  count,
  ingredients,
  summary,
  loading,
}: {
  count: number;
  ingredients: Partial<Ingredient>[];
  summary?: string;
  loading: boolean;
}) {
  const natural = ingredients.filter((i) => i.tag === "Natural").length;
  const processed = ingredients.filter((i) => i.tag === "Processed").length;

  return (
    <div className="mt-6">
      <div className="flex items-end gap-3">
        <span className="font-display text-[52px] leading-[0.82] text-natural tabular-nums sm:text-[58px]">
          {count}
        </span>
        <div className="pb-1.5">
          <p className="font-display text-xl leading-tight text-ink sm:text-[23px]">
            {count === 1 ? "ingredient" : "ingredients"} in this product
          </p>
          <p className="mt-1 text-sm tabular-nums text-muted">
            In label order — {natural} natural, {processed} processed
          </p>
        </div>
      </div>

      {summary ? (
        <p className="mt-4 animate-rise text-[15px] leading-[1.6] text-ink/80">{summary}</p>
      ) : (
        loading && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted">
            <Spinner className="h-3.5 w-3.5" />
            Reading the formulation…
          </p>
        )
      )}

      <p className="mt-3 text-xs text-muted">
        Tap any ingredient to see what it is and why it&rsquo;s here.
      </p>
    </div>
  );
}

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span
      className={`${className} animate-spin rounded-full border-2 border-line border-t-natural`}
      aria-hidden
    />
  );
}
