# Pre-launch runbook

> Everything the code **can't** do itself — accounts, dashboards, DNS, spend approvals, and product
> decisions. Ordered so blockers come first. Owners: **M** = Miquel · **J** = Jitain · CC = already
> shipped in code. Tick as you go.
>
> Status of the code side: the beta feature set and the S-series hardening are code-complete and
> pushed. What remains here is operational + editorial.

---

## 0 · GitHub org transfer (do first — 2 min) — M
The repo moved into the `baloo-ingredient-analysis` org; pushes still work via a redirect but the
remote should point at the new URL.

- [ ] Repoint the remote:
  ```bash
  git remote set-url origin https://github.com/baloo-ingredient-analysis/Baloo-landing-page.git
  ```
- [ ] Verify (two separate lines — PowerShell rejects `&&`):
  ```
  git remote -v
  git fetch origin
  ```
  `fetch` should complete with **no** "repository moved" warning.
- [ ] **Confirm Vercel still deploys from the new repo:** Vercel → project → Settings → Git → points at
  `baloo-ingredient-analysis/Baloo-landing-page`. Re-link if auto-deploys stopped. *(The one transfer
  side-effect that can silently break prod.)*

## 1 · Vercel env + firewall — M
- [ ] **Upstash Redis REST vars** — Settings → Environment Variables: `UPSTASH_REDIS_REST_URL` +
  `UPSTASH_REDIS_REST_TOKEN`. **Until these exist, all rate-limiting (S1 + S4), the homepage board, and
  the caches are inert.** The Vercel Redis integration exposes `REDIS_URL`, which the code does *not*
  read — the REST pair is required.
- [ ] Confirm the rest are present: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `FIRECRAWL_API_KEY`.
- [ ] Firewall → enable **WAF / Attack Challenge Mode** (S5 leftover).

## 2 · Email / SMTP (signup breaks at launch without it) — M
Full step-by-step: [`docs/EMAIL_SETUP.md`](EMAIL_SETUP.md). In brief:
- [ ] Resend account; add **`baloo.life` on a sending subdomain** (e.g. `send.baloo.life`); create a
  send-scoped API key.
- [ ] DNS: **SPF + DKIM** (from Resend) + **DMARC** (`_dmarc.baloo.life`, start `p=none`). Required by
  Gmail/Yahoo bulk-sender rules.
- [ ] Supabase → Authentication → **SMTP** = `smtp.resend.com`, user `resend`, password = the API key,
  sender on the verified domain. Then **raise the auth email rate limit**.
- [ ] Supabase → Authentication → **URL Configuration**: Site URL `https://baloo.life`; **Redirect
  URLs** = `https://baloo.life/auth/callback`, `https://*.vercel.app/auth/callback`,
  `http://localhost:3000/auth/callback`. *The shipped `emailRedirectTo` code (S3) and the reset flow
  (S7c) don't work without these entries.*
- [ ] Test: sign up with a real inbox + a Gmail address → link arrives, not in spam, SPF/DKIM/DMARC all
  PASS, lands signed in. Test **Forgot password** too (S7c).

## 3 · Supabase security toggle — M
- [ ] Authentication → Passwords → enable **leaked-password protection** (clears a standing advisor
  warning).
- [ ] *(Low priority)* move the `pg_trgm` extension out of the `public` schema (standing advisor warning).

## 4 · Seed supply (L4) — J picks, M runs
Tooling is shipped (`npm run db:seed-supply`, dry-run by default). Blocked on:
- [ ] **J:** choose real product URLs for the 4 lists — **only** from Whole Foods · Ocado · Tesco ·
  Target · Kroger (the supported retailers). Put them in `scripts/seed-supply.ts`.
- [ ] **M:** approve the spend (~20 products × 1 Firecrawl + 2 Claude calls; the dry run prints the
  estimate) and choose **dev vs production** Supabase, then:
  ```bash
  npm run db:seed-supply -- --commit
  ```
  Afterwards, set each official account's password from the Supabase dashboard (they're created
  password-less).
- [ ] **J:** decide **"Mercadona essentials"** — it can't be built (Mercadona isn't a supported
  retailer). Either drop the list or greenlight adding `mercadona.es` as a code order. *Note: all 5
  current retailers are US/UK, so a Spanish launch audience currently has nothing purchasable.*

## 5 · Make Jitain an admin — M
- [ ] Once J has an account:
  ```bash
  npx tsx scripts/make-admin.ts <his-handle>
  ```

## 6 · Legal — J
- [ ] **S8 — privacy policy + terms** on baloo.life. No cookie banner needed while analytics-free (auth
  cookies are strictly-necessary/exempt); adding GA or a Meta pixel changes that.

## 7 · Product decisions owed — J
- [ ] **`role` microlabel** on ingredient rows — keep, or drop as V3 does?
- [ ] **Comments / feed / moderation at launch** — keep exposed or de-emphasise? *(CC rec: keep comments
  + moderation on, keep the feed but de-emphasise — search is the front door.)*
- [ ] **Semantic search infra (L3)** — pgvector embeddings vs LLM-rerank over pg_trgm. Decide at L3 plan
  time.

---

## Still on the code side (not blocking, no owner input needed)
- **S6 — Sentry** wiring (needs a `SENTRY_DSN` from M, but the instrumentation is CC's to add).
- **N1 — in-app notifications** (Tier B; the `activity` table already seeds it).
- **L3 — semantic search** (Tier B; gated on decision 7).
- L2 follow-ups: portrait/IG card, profile + product share cards, product-page share mount.

_Keep this in sync as items land; the authoritative feature record is `docs/CHANGELOG.md`._
