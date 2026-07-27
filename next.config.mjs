/** @type {import('next').NextConfig} */

// Security response headers (Order S5). The enforcing set is safe on any HTTPS host; the CSP is
// REPORT-ONLY for now (observe violations without breaking Supabase auth, Next's inline hydration,
// or styles) — flip it to enforcing once report-only is clean in prod. All headers apply to every
// route.

// Supabase is the only cross-origin the browser talks to (auth + REST + future realtime). Derive its
// origin from the public env var so connect-src stays correct across projects; fall back to 'self'.
function supabaseOrigins() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return "";
  try {
    const { protocol, host } = new URL(url);
    return protocol === "https:" ? ` https://${host} wss://${host}` : ` ${url}`;
  } catch {
    return "";
  }
}

// Sentry (Order S6): the browser SDK POSTs errors to the DSN's ingest host. Derive that origin from
// the public DSN so connect-src stays correct once the CSP flips to enforcing; empty when Sentry is
// off, so it adds nothing until a DSN is set.
function sentryOrigin() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return "";
  try {
    return ` ${new URL(dsn).origin}`;
  } catch {
    return "";
  }
}

const csp = [
  "default-src 'self'",
  // Next injects inline hydration scripts (no nonce here); 'unsafe-eval' covers dev HMR. Report-only.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'", // Tailwind + framework-injected styles
  "img-src 'self' data: blob:",
  "font-src 'self'", // fonts are self-hosted via next/font
  `connect-src 'self'${supabaseOrigins()}${sentryOrigin()}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Content-Security-Policy-Report-Only", value: csp },
];

const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
