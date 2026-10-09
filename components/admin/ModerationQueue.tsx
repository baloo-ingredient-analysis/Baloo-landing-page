"use client";

// Moderation queue (Order G9). Admin-only surface: open reports with a target preview, actioned
// in place. Calls /api/moderation then drops the row optimistically.

import { useState } from "react";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import type { QueueReport } from "@/lib/db/queries/reports";

const REASON_LABEL: Record<string, string> = {
  spam: "Spam",
  abuse: "Abuse or harassment",
  off_topic: "Off-topic",
  other: "Other",
};

export function ModerationQueue({ initial }: { initial: QueueReport[] }) {
  const [reports, setReports] = useState<QueueReport[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(r: QueueReport, action: "hide" | "dismiss") {
    setBusy(r.id);
    try {
      const res = await fetch("/api/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetType: r.targetType, targetId: r.targetId }),
      });
      if (res.ok) setReports((prev) => prev.filter((x) => x.id !== r.id));
    } finally {
      setBusy(null);
    }
  }

  if (reports.length === 0) {
    return <p className="mt-8 text-sm text-muted">Nothing to review. The queue is clear.</p>;
  }

  return (
    <ul className="mt-8 space-y-3">
      {reports.map((r) => (
        <li key={r.id} className="rounded-xl border border-line bg-paper p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="rounded-full bg-canvas px-2 py-0.5 font-medium uppercase tracking-[0.08em]">
              {r.targetType}
            </span>
            <span className="rounded-full bg-canvas px-2 py-0.5 font-medium">
              {REASON_LABEL[r.reason] ?? r.reason}
            </span>
            <span className="tabular-nums">@{r.reporterHandle}</span>
            {r.alreadyHidden && <span className="text-processed">· already hidden</span>}
          </div>

          <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-[15px] text-ink/80">
            {r.preview || "(empty)"}
          </p>
          {r.targetHref && (
            <LocalizedLink href={r.targetHref} className="mt-1 inline-block text-[13px] text-natural hover:underline">
              View →
            </LocalizedLink>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => act(r, "hide")}
              disabled={busy === r.id || r.alreadyHidden}
              className="rounded-lg bg-ink px-3.5 py-1.5 text-[13px] font-medium text-paper transition hover:bg-ink/85 disabled:opacity-40"
            >
              {r.targetType === "comment" ? "Hide comment" : "Unpublish list"}
            </button>
            <button
              type="button"
              onClick={() => act(r, "dismiss")}
              disabled={busy === r.id}
              className="rounded-lg border border-line px-3.5 py-1.5 text-[13px] font-medium text-muted transition hover:text-ink disabled:opacity-40"
            >
              Dismiss
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
