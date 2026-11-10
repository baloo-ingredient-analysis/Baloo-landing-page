import type { Provider } from "@supabase/supabase-js";

// Social-login providers the app has code for. A provider only appears in the UI once it is BOTH
// listed in NEXT_PUBLIC_OAUTH_PROVIDERS and enabled in the Supabase dashboard. Keeping the list in
// an env var means lighting one up is config plus a Supabase toggle, never a code change — the same
// optional-infra pattern as the rest of the stack. Setup steps per provider: docs/SOCIAL_LOGIN_SETUP.md.

export type OAuthProvider = Extract<Provider, "google" | "apple" | "facebook">;

export type OAuthProviderButton = { id: OAuthProvider; label: string };

// All providers we have handlers for, in display order.
const ALL: OAuthProviderButton[] = [
  { id: "google", label: "Continue with Google" },
  { id: "apple", label: "Continue with Apple" },
  { id: "facebook", label: "Continue with Facebook" },
];

const SUPPORTED = new Set<OAuthProvider>(ALL.map((p) => p.id));

function isOAuthProvider(name: string): name is OAuthProvider {
  return SUPPORTED.has(name as OAuthProvider);
}

/**
 * Parse the comma-separated NEXT_PUBLIC_OAUTH_PROVIDERS value into the buttons to render, preserving
 * ALL's display order and dropping anything we don't support. Absent or empty-of-matches falls back
 * to Google alone, so the current behaviour is unchanged until the var names something else and that
 * provider is also switched on in Supabase.
 */
export function parseEnabledProviders(raw: string | undefined): OAuthProviderButton[] {
  const names = new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(isOAuthProvider),
  );
  const picked = ALL.filter((p) => names.has(p.id));
  return picked.length ? picked : [ALL[0]];
}

// NEXT_PUBLIC_* is inlined at build time, so this resolves once per build.
export const OAUTH_PROVIDERS: OAuthProviderButton[] = parseEnabledProviders(
  process.env.NEXT_PUBLIC_OAUTH_PROVIDERS,
);
