import * as Sentry from "@sentry/nextjs";

// Error monitoring — browser (Order S6). Next.js auto-loads this file on the client.
//
// Uses the PUBLIC DSN because it necessarily ships to the browser. A Sentry DSN is NOT a secret (it's
// a write-only ingest key; abuse is handled Sentry-side by rate limits + an allowed-domains list), so
// a NEXT_PUBLIC_ prefix is correct here — unlike our real secrets. Guarded, so no DSN = no-op.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    // Session Replay stays OFF by default (privacy + cost); turn on deliberately later if wanted.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
  });
}

// Instruments client-side navigations so a broken route transition is captured.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
