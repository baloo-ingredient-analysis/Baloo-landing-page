"use client";

import { useState } from "react";
import type { Ingredient } from "@/lib/schema";
import { deriveTag } from "@/lib/schema";

// Order F2: the progressive ingredient row. Collapsed by default — rank, name (+% chip),
// a caps role microlabel, the origin/processed chips, a chevron — and unfolds to the full
// Order-A depth on tap. Multi-open accordion: each row keeps its own state; opening one never
// closes another. Rows without `role` (results cached before F1) render single-line with no
// placeholder, per the design handoff's old-cache state.
//
// TAGS (team decision, 16 Oct 2026): two INDEPENDENT axes — origin (Natural / Artificial) and
// processed (yes/no) — so an ingredient can read "Natural · Processed" (e.g. olive oil), which is
// exactly the literacy point (processed ≠ bad; natural ≠ unprocessed). Natural stays the one green,
// Processed the one amber; Artificial is a NEUTRAL ink chip, deliberately never red/alarm. Tapping
// Processed reveals a short neutral note — no numbered scale (that would be an implicit score).
// Stored/legacy ingredients that lack the two axes fall back to the single derived `tag` chip.
export function IngredientRow({
  ingredient,
  index,
}: {
  ingredient: Partial<Ingredient>;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const [procOpen, setProcOpen] = useState(false);
  const bodyId = `ingredient-body-${index}`;
  const procId = `ingredient-processing-${index}`;

  const hasAxes = !!(ingredient.origin || ingredient.processed);
  const showNatural = ingredient.origin === "natural";
  const showArtificial = ingredient.origin === "artificial";
  const showProcessed = ingredient.processed === "yes";
  // Legacy fallback: no axes but a stored tag → the old single chip (Natural green / Processed amber).
  const legacyTag = !hasAxes && ingredient.tag ? deriveTag(ingredient) : null;
  const hasChips = showNatural || showArtificial || showProcessed || !!legacyTag;

  const toggle = () => setOpen((o) => !o);

  return (
    <li className={`animate-rise list-none transition-colors ${open ? "bg-canvas" : ""}`}>
      {/* flex-wrap so on a narrow screen the chips drop to their own line (full width, right-aligned)
          instead of colliding with a long name/role; one line on sm+ via flex-nowrap + order. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 sm:flex-nowrap sm:px-5">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="order-1 flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="w-6 shrink-0 font-display text-[15px] tabular-nums text-muted">
            {index + 1}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="flex flex-wrap items-baseline gap-2">
              <span className="font-display text-base leading-tight text-ink">
                {ingredient.name ?? "…"}
              </span>
              {ingredient.percentage && (
                <span className="rounded-md bg-canvas px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted">
                  {ingredient.percentage}
                </span>
              )}
            </span>
            {ingredient.role && (
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                {ingredient.role}
              </span>
            )}
          </span>
        </button>

        {hasChips && (
          <span className="order-3 flex w-full flex-wrap items-center justify-end gap-1.5 sm:order-2 sm:w-auto">
            {showNatural && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-natural-soft px-2.5 py-1 text-xs font-medium text-natural">
                <span className="h-1.5 w-1.5 rounded-full bg-natural" aria-hidden />
                Natural
              </span>
            )}
            {showArtificial && (
              // Neutral ink chip — Artificial is a plain origin descriptor, never an alarm colour.
              <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-xs font-medium text-ink/75 ring-1 ring-inset ring-line">
                <span className="h-1.5 w-1.5 rounded-full bg-muted" aria-hidden />
                Artificial
              </span>
            )}
            {showProcessed && (
              <button
                type="button"
                onClick={() => setProcOpen((o) => !o)}
                aria-expanded={procOpen}
                aria-controls={procId}
                className="inline-flex items-center gap-1.5 rounded-full bg-processed-soft px-2.5 py-1 text-xs font-medium text-processed transition hover:ring-1 hover:ring-inset hover:ring-processed/30"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-processed" aria-hidden />
                Processed
              </button>
            )}
            {legacyTag && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  legacyTag === "Processed"
                    ? "bg-processed-soft text-processed"
                    : "bg-natural-soft text-natural"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    legacyTag === "Processed" ? "bg-processed" : "bg-natural"
                  }`}
                  aria-hidden
                />
                {legacyTag}
              </span>
            )}
          </span>
        )}

        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={open ? "Hide details" : "Show details"}
          className="order-2 shrink-0 text-muted sm:order-3"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            <path d="M3.5 6l4.5 4.5L12.5 6" />
          </svg>
        </button>
      </div>

      {/* Processed reveal: a short NEUTRAL note on what "processed" means — no method/degree yet
          (deferred with the engine), and never a numbered scale. */}
      <div
        id={procId}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          procOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mx-4 mb-1 rounded-lg border border-line bg-paper px-3.5 py-3 sm:mx-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-processed">
              Processed
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink/80">
              This ingredient has been changed from its whole state — for example by pressing,
              extracting, refining, or fermenting it. “Processed” describes what was done to it, not
              whether it’s good or bad.
            </p>
          </div>
        </div>
      </div>

      {/* Unfold: grid-rows 0fr -> 1fr (200ms). The global reduced-motion rule zeroes it. */}
      <div
        id={bodyId}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pb-4 pl-[52px] pr-5 pt-0.5 sm:pl-[56px]">
            {ingredient.what_it_is && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  What it is
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink/80">{ingredient.what_it_is}</p>
              </div>
            )}
            {ingredient.why_its_here && (
              <div className="mt-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  In this product
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink/80">{ingredient.why_its_here}</p>
              </div>
            )}
            {ingredient.percentage_note && (
              <p className="mt-3.5 border-t border-line pt-2.5 text-xs leading-relaxed text-muted">
                {ingredient.percentage_note}
              </p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
