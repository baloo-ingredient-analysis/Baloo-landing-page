"use client";

import { useState } from "react";
import type { Ingredient } from "@/lib/schema";

// Order F2: the progressive ingredient row. Collapsed by default — rank, name (+% chip),
// a caps role microlabel, the Natural/Processed pill, a chevron — and unfolds to the full
// Order-A depth on tap. Multi-open accordion: each row keeps its own state; opening one never
// closes another. Rows without `role` (results cached before F1) render single-line with no
// placeholder, per the design handoff's old-cache state.
export function IngredientRow({
  ingredient,
  index,
}: {
  ingredient: Partial<Ingredient>;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const isProcessed = ingredient.tag === "Processed";
  const bodyId = `ingredient-body-${index}`;

  return (
    <li className={`animate-rise list-none transition-colors ${open ? "bg-canvas" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"
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

        {ingredient.tag && (
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              isProcessed ? "bg-processed-soft text-processed" : "bg-natural-soft text-natural"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${isProcessed ? "bg-processed" : "bg-natural"}`}
              aria-hidden
            />
            {ingredient.tag}
          </span>
        )}

        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          <path d="M3.5 6l4.5 4.5L12.5 6" />
        </svg>
      </button>

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
