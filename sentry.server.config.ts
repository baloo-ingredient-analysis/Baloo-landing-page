import * as Sentry from "@sentry/nextjs";

// Error monitoring — server + route-handler runtime (Order S6).
//
// Optional-infra rule (same as Redis/DB/email): guarded on the DSN, so with no SENTRY_DSN this is a
// complete no-op — nothing initialises, nothing is sent, the app boots identically. Sentry switches
// on the moment M sets SENTRY_DSN on Vercel; no code change needed.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // No PII in reports — matches the app's "never a raw error/never leak user data" contract.
    sendDefaultPii: false,
  });
}
