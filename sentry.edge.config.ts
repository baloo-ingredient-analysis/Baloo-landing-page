import * as Sentry from "@sentry/nextjs";

// Error monitoring — edge runtime, i.e. middleware (Order S6). Same guarded, no-op-without-DSN
// pattern as the server config.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    sendDefaultPii: false,
  });
}
