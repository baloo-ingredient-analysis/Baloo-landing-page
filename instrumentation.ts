import * as Sentry from "@sentry/nextjs";

// Server/edge instrumentation entrypoint (Order S6). Next.js calls register() once per runtime at
// startup; we load the matching guarded Sentry config. All of it is a no-op without SENTRY_DSN.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

// Captures errors thrown in Server Components, route handlers, and middleware.
export const onRequestError = Sentry.captureRequestError;
