// Session-refresh middleware (Order G2) — the @supabase/ssr pattern: keep auth tokens fresh on
// every request so server components and route handlers always see a valid session. Complete
// no-op when Supabase env is absent (the app runs with no auth configured).

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { i18nEnabled, stripLocale } from "@/lib/i18n/config";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Languages (localized URLs): English at the root, Spanish under /es. Read the locale off the URL
  // (only when i18n is enabled), set it as `x-locale` for server components, and strip the /es prefix
  // from the internal rewrite target. Composes with the /@handle rewrite below.
  const locale: "en" | "es" =
    i18nEnabled() && (pathname === "/es" || pathname.startsWith("/es/")) ? "es" : "en";
  let target = locale === "es" ? stripLocale(pathname) : pathname;

  // Vanity profile URLs (L5a): serve `/@handle` from the real `/u/[handle]` page via an internal
  // rewrite — the browser keeps the pretty `/@handle` (+ any ?tab=…). Handles can't contain "/", so
  // only the first segment is the handle; anything deeper falls through to a 404 as before.
  if (target.startsWith("/@") && target.length > 2) target = `/u/${target.slice(2)}`;

  const needsRewrite = target !== pathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-locale", locale);

  const base = () => {
    if (needsRewrite) {
      const u = request.nextUrl.clone();
      u.pathname = target; // query string preserved by clone
      return NextResponse.rewrite(u, { request: { headers: requestHeaders } });
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return base();

  let response = base();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = base(); // rebuild — preserving the rewrite — then re-attach refreshed cookies
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Touching getUser() refreshes an expired access token via the refresh token.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Skip static assets; run everywhere else (API routes included — they read the session).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
