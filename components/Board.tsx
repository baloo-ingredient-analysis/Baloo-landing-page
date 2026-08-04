"use client";

import { useEffect, useState } from "react";
import type { Board as BoardData } from "@/lib/stats";

type BoardPayload = BoardData & { showTopScanners?: boolean };

// Order D: the idle-homepage board ("On Baloo right now"), Ledger layout per the design
// handoff. Load-time fetch only — no polling. The board is decoration: until data arrives,
// and on any failure, it simply isn't there. Never an error state.
export function Board() {
  const [data, setData] = useState<BoardPayload | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/board", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setData(d);
      })
      .catch(() => {
        /* silent — the homepage stands on its own */
      });
    return () => controller.abort();
  }, []);

  if (!data) return null;
  return <BoardView data={data} />;
}

// Presentational and fixture-drivable (used by Board above; handy for layout work and reuse).
export function BoardView({ data }: { data: BoardPayload }) {
  const recent = data.recent.slice(0, 7);

  return (
    <section className="mt-14 animate-fade-in text-left">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="h-2 w-2 animate-pulse-dot rounded-full bg-natural ring-4 ring-natural-soft"
        />
        <h2 className="font-display text-2xl text-ink">On Baloo right now</h2>
      </div>
      <p className="mt-2 text-sm text-muted">
        What people are scanning — every scan quietly adds to the board.
      </p>

      <div className="mt-4 rounded-2xl border border-line bg-paper p-6 shadow-card">
        {/* 1 · Recently scanned */}
        <div className="flex items-baseline justify-between gap-3">
          <PanelLabel>Recently scanned</PanelLabel>
          <span className="text-xs text-muted">last 30</span>
        </div>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Nothing scanned yet. Paste a link above and you&apos;ll be first on the board.
          </p>
        ) : (
          <ul className="mt-2">
            {recent.map((scan, i) => (
              <li
                key={`${scan.ts}-${i}`}
                className="flex items-baseline justify-between gap-3 border-t border-line py-2.5"
              >
                <span className="min-w-0 truncate text-sm">
                  <span className="font-medium text-ink">{scan.product_name}</span>
                  {scan.retailer && <span className="text-muted"> · {scan.retailer}</span>}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted">
                  {scan.country ? `${scan.country} · ` : ""}
                  {timeAgo(scan.ts)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="my-5 border-t border-line" aria-hidden />

        {/* 2 · Top supermarkets / Top countries */}
        <div className="grid gap-7 sm:grid-cols-2">
          <RankedPanel label="Top supermarkets" entries={data.topRetailers} />
          <RankedPanel
            label="Top countries"
            entries={data.topCountries.map((c) => ({ ...c, name: countryName(c.name) }))}
          />
        </div>

        {/* 3 · Top scanners — flagged off until accounts exist */}
        {!data.showTopScanners && (
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
            <div className="flex items-center gap-3">
              <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-canvas">
                <LockIcon />
              </span>
              <span>
                <span className="block text-sm text-ink">Top scanners</span>
                <span className="block text-xs text-muted">
                  Arrives with Baloo accounts — scan history and streaks.
                </span>
              </span>
            </div>
            <span className="shrink-0 rounded-full bg-line px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-ink/70">
              Coming soon
            </span>
          </div>
        )}
      </div>

      <p className="mt-3.5 text-xs text-muted">
        Recorded at country level only — no personal data, no exact location.
      </p>
    </section>
  );
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink">{children}</h3>
  );
}

function RankedPanel({
  label,
  entries,
}: {
  label: string;
  entries: { name: string; count: number }[];
}) {
  const top = entries.slice(0, 5);
  const max = top[0]?.count ?? 0;

  return (
    <div>
      <PanelLabel>{label}</PanelLabel>
      {top.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No scans yet.</p>
      ) : (
        <ul className="mt-1.5">
          {top.map((entry, i) => (
            <li key={entry.name} className="flex items-center gap-3 py-2">
              <span className="w-3 shrink-0 text-xs tabular-nums text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{entry.name}</span>
              <span aria-hidden className="h-1 w-14 shrink-0 rounded-full bg-line">
                <span
                  className="block h-1 rounded-full bg-ink/30"
                  style={{ width: `${max > 0 ? (entry.count / max) * 100 : 0}%` }}
                />
              </span>
              <span className="w-11 shrink-0 text-right text-[13px] tabular-nums text-muted">
                {entry.count.toLocaleString("en-GB")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 15 15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-[15px] w-[15px] text-muted"
    >
      <rect x="2.5" y="6.5" width="10" height="6.5" rx="1.5" />
      <path d="M4.5 6.5V5a3 3 0 016 0v1.5" />
    </svg>
  );
}

// "just now" under 45s, then minutes/hours (and days past 24h). Code-side, en-GB style.
function timeAgo(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// Country codes from Vercel geolocation ("GB") → readable names, raw code as fallback.
function countryName(code: string): string {
  try {
    return new Intl.DisplayNames("en", { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
