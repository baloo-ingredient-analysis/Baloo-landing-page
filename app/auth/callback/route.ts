import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// OAuth / magic-link / recovery landing (Order G2): exchanges the PKCE code for a session cookie,
// then sends the user on (the client's useAuth picks the session up and routes to /welcome if the
// handle-setup step is still pending).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (code) {
    const sb = await supabaseServer();
    if (sb) await sb.auth.exchangeCodeForSession(code);
  }

  // `next` lets a flow land somewhere other than home once the session exists — the password-reset
  // link (S7c) uses it to reach /auth/reset in a recovery session. Same-origin only: it must be a
  // root-relative path (starts with "/", not "//"), so it can never become an open redirect.
  const next = url.searchParams.get("next");
  const dest = next && /^\/(?!\/)/.test(next) ? next : "/";
  return NextResponse.redirect(new URL(dest, url.origin));
}
