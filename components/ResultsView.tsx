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
  availability,
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
  availability?: React.ReactNode; // P4 "From X · also at Y, Z"; replaces the plain retailer line when set
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
        {availability ?? (
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
        )}
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
          <span className="rounded-full bg-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-ink/70">
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

            <IngredientsSection ingredients={ingredients} loading={loading} />
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
// "feel striking, or give a sensation that it's clean" (Jitain). Counts are computed HERE in code;
// the model never counts (CLAUDE.md).
//
// The hero number MUST match the list the reader sees. `count` (from extract) is only the initial
// placeholder shown before any ingredient has streamed in; once rows arrive, the analysed list is the
// source of truth. They can differ when the analyser splits a compound ingredient (e.g. a single
// "Live Cultures (…)" label into its 3 named cultures) — which previously left the hero saying "2"
// while the list + the natural/processed tally showed 4. Deriving from `ingredients` keeps all three
// in agreement.
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
  const shown = ingredients.length > 0 ? ingredients.length : count;

  return (
    <div className="mt-6">
      <div className="flex items-end gap-3">
        <span className="font-display text-[52px] leading-[0.82] text-natural tabular-nums sm:text-[58px]">
          {shown}
        </span>
        <div className="pb-1.5">
          <p className="font-display text-xl leading-tight text-ink sm:text-[23px]">
            {shown === 1 ? "ingredient" : "ingredients"} in this product
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
    </div>
  );
}

// The ingredient list, nested inside a collapsible "Ingredients" section (Jitain): keep the screen
// calm by default — the hero count + summary stay visible, the full list appears only if the reader
// wants it. Open while a live analysis streams in (so the reveal still happens), collapsed on a
// cached product page. Inside, each row still opens to "what it is" / "in this product".
function IngredientsSection({
  ingredients,
  loading,
}: {
  ingredients: Partial<Ingredient>[];
  loading: boolean;
}) {
  const [open, setOpen] = useState(loading);

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-paper shadow-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="ingredients-list"
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-canvas sm:px-5"
      >
        <span className="flex items-center gap-2">
          <span className="font-display text-base text-ink">Ingredients</span>
          <span className="rounded-md bg-canvas px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted">
            {ingredients.length}
          </span>
        </span>
        <span className="flex items-center gap-2 text-xs text-muted">
          <span className="hidden sm:inline">{open ? "Hide" : "Show"}</span>
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            <path d="M3.5 6l4.5 4.5L12.5 6" />
          </svg>
        </span>
      </button>

      {/* Unfold: grid-rows 0fr → 1fr, the same idiom the rows use. Reduced-motion rule zeroes it. */}
      <div
        id="ingredients-list"
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <ul className="border-t border-line [&>li+li]:border-t [&>li+li]:border-line">
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
        </div>
      </div>
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
