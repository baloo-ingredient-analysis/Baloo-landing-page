# Username (handle) rules

Status: **implemented, for team sign-off.** One source of truth: [`lib/handle.ts`](../lib/handle.ts)
(`validateHandle`), used by the API (`app/api/profile`) and the welcome UI, covered by
[`lib/handle.test.ts`](../lib/handle.test.ts). Handles are the public identity in `/u/[handle]` and in
the security rules, so the bar is "clean, unique, unmistakable, non-impersonating."

## The rules

| Rule | Value |
|---|---|
| Length | **3–20** characters |
| Allowed characters | lowercase **a–z**, digits **0–9**, and **hyphens** |
| Hyphen placement | no **leading**, **trailing**, or **doubled** hyphens (`-x`, `x-`, `a--b` rejected) |
| Case | case-insensitive; input is lowercased before saving |
| Uniqueness | case-insensitive unique (enforced in code + a DB constraint) |
| Reserved | can't be a route, role, generic account word, or the brand (see below) |

Normalisation runs first (`NFKC` + trim + lowercase), so look-alike unicode (e.g. a fullwidth
`ａｄｍｉｎ`) folds to `admin` and is caught by the reserved check rather than slipping through.

**Grandfathering:** validation only runs when a handle is **set or changed**. Existing handles are
untouched.

## Reserved handles

Exact matches only — `baloo` is blocked but `baloo-dev` is fine. Three buckets (full list in
`lib/handle.ts`):
- **Routes / paths:** `api`, `admin`, `settings`, `discover`, `feed`, `list(s)`, `p`, `u`, `login`,
  `search`, `about`, `help`, `terms`, `privacy`, … (so a handle can never shadow or be confused with a URL)
- **Roles / impersonation:** `official`, `staff`, `moderator`, `mod`, `support`, `security`, `team`
- **Brand:** `baloo`, `balooapp`, `baloolife`, `baloofood`, `baloo-team`, `baloo-official`

## Errors the user sees

Each failure returns one friendly line (no raw errors), shown live on the welcome screen:
- length → "Handles are 3–20 characters."
- charset → "Use only lowercase letters, numbers and hyphens."
- edges → "Hyphens can't start, end, or repeat."
- reserved → "That handle is reserved — pick another."
- taken → "That handle's taken — try another." (409, from the uniqueness check)

## Decisions for the team

These are choices, not bugs — worth a quick 👍 / change:
1. **Underscores:** intentionally **not** allowed (keeps handles URL-clean). Add them? *(proposed: no)*
2. **Profanity / slurs:** **not** yet filtered — the reserved list covers routes/roles/brand, not
   offensive words. This is a tone/policy call. *(proposed: add a curated blocklist, or a small
   wordlist dependency, once we agree how strict — deliberately left out of code until decided.)*
3. **All-numeric handles** (e.g. `12345`): currently **allowed** (no clash — profile URLs use the
   handle, internal IDs are UUIDs). Block them? *(proposed: allow)*
4. **Handle changes:** the API already supports re-setting your own handle; we have **not** added a
   cooldown or an old-handle redirect. *(proposed: fine for beta; revisit if squatting appears.)*
