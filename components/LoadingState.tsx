"use client";

import { useT } from "@/lib/i18n/context";

export function LoadingState({ phase }: { phase: "reading" | "analyzing" }) {
  const t = useT();
  const label = phase === "reading" ? t.loading.readingLabel : t.loading.analysingLabel;
  const sub = phase === "reading" ? t.loading.readingSub : t.loading.analysingSub;

  return (
    <div className="mt-14 flex flex-col items-center gap-3 text-center animate-fade-in">
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-natural"
        aria-hidden
      />
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-sm text-muted">{sub}</p>
      </div>
    </div>
  );
}
