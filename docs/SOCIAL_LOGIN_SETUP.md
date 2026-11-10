# Social login setup (Google / Apple / Facebook)

Runbook for turning on OAuth sign-in. The app code is already built and provider-agnostic, so
each provider is console setup plus a Supabase toggle, not a dev task.

## What already exists in the code

- `components/auth/AuthModal.tsx` has `signInWithOAuth({ provider })` (currently a Google button).
- `app/auth/callback/route.ts` exchanges the PKCE `code` for a session. It is provider-agnostic,
  so it works for any provider without changes.
- New OAuth users are routed to `/welcome` for username setup, so the profile/handle flow already
  covers social sign-ups (no name/email from the provider is fine).

Which buttons render is driven by `NEXT_PUBLIC_OAUTH_PROVIDERS` (comma-separated:
`google`, `apple`, `facebook`; absent means Google only), parsed in `lib/auth/oauthProviders.ts`.
So turning a provider on for users is: enable it in Supabase, then add its name to that env var. No
code change. Everything below is the part that actually gates it: the external consoles.

## The two URLs you need everywhere

- **Provider redirect / callback URI** (paste into Google, Apple, Facebook as the authorised
  redirect): `https://pppwlwelzhyizlphxcfp.supabase.co/auth/v1/callback`
- **Supabase redirect allowlist** (Supabase dashboard, Authentication, URL Configuration, Redirect
  URLs) must include every app origin plus `/auth/callback`:
  - `https://baloo.life/auth/callback` (once the domain points at Vercel)
  - `https://baloo-web-*.vercel.app/auth/callback` (preview deploys)
  - `http://localhost:3000/auth/callback` (local dev)

## Prerequisite: point baloo.life at Vercel

All three providers want a stable, live domain for their consent screen and redirect config. Until
baloo.life serves the Vercel app (the standing launch blocker), set everything up against the
Vercel URL and add baloo.life afterwards.

## Google

Fastest, cheapest, no code left. Do this one first.

1. Google Cloud Console, create or pick a project.
2. APIs & Services, OAuth consent screen: external, add app name, support email, the baloo.life
   homepage and privacy-policy URL, and your email as a test user while in testing.
3. Credentials, Create Credentials, OAuth client ID, type Web application. Authorised redirect URI =
   the Supabase callback URL above. Copy the Client ID and Client secret.
4. Supabase dashboard, Authentication, Providers, Google: enable, paste the Client ID and secret.
5. Test the existing "Continue with Google" button on a preview deploy.

Note: the consent screen needs verification before it serves all users with sensitive scopes. Basic
email/profile is light, but the domain and privacy-policy URL must be real.

## Apple

Small code, but has a yearly cost and a recurring chore.

1. Apple Developer Program membership (**99 USD/year**) is required.
2. Certificates, Identifiers & Profiles:
   - App ID (if not already present).
   - Services ID (this is the OAuth client id). Enable Sign in with Apple, configure the domain and
     the Supabase callback URL as the return URL.
   - A Sign in with Apple key. Download the `.p8` key file.
3. Generate the client secret, which is a JWT signed with that key. **It expires every 6 months and
   must be regenerated** (or automated), or Apple login breaks silently.
4. Supabase, Authentication, Providers, Apple: enable, paste the Services ID and the generated
   secret.
5. Add `apple` to `NEXT_PUBLIC_OAUTH_PROVIDERS` (e.g. `google,apple`) and redeploy. No code change.

Gotchas: Apple returns the user's name only on the first authorisation, and email may be a private
relay address. The `/welcome` handle flow already tolerates missing data.

## Facebook (Meta)

Trivial on our side, but gated by Meta review before it works for the public.

1. developers.facebook.com, create an app, add the Facebook Login product.
2. App settings: copy the App ID and App secret. Facebook Login settings: add the Supabase callback
   URL as a Valid OAuth Redirect URI.
3. Supabase, Authentication, Providers, Facebook: enable, paste the App ID and secret.
4. Add `facebook` to `NEXT_PUBLIC_OAUTH_PROVIDERS` and redeploy. No code change.
5. **Going live**: in development mode only app admins/testers can log in. For all users the app must
   be switched to Live and pass **Meta App Review** for `email` + `public_profile`, plus Meta
   Business Verification. Budget roughly 2 to 4 weeks of wall-clock for review.

## Instagram: not reachable via Facebook login

Logging in with Facebook grants Facebook profile and email only. It gives zero access to the user's
Instagram, and there is no Instagram login for normal users (the Basic Display API shut down on
4 Dec 2024). Instagram access through Meta exists only for Business/Creator accounts linked to a
Facebook Page, via the Instagram Graph API.

The one realistic Instagram automation is auto-posting from **our own** Baloo Instagram (a Business
account + linked Page) using Meta's Content Publishing API. That could auto-publish the share cards
we already generate, and it is a separate project from social login, not connected to any user's
account.

## Recommended order

1. Google (no code, cheapest, fastest).
2. Apple (table stakes for the eventual iOS app; accept the 99 USD/yr + 6-month secret rotation).
3. Facebook (do the setup, then wait out Meta App Review). Lowest payoff of the three, and it does
   not unlock Instagram.
