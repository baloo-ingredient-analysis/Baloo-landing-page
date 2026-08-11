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
| Profanity | strict blocklist — slurs and strong profanity, incl. leetspeak/padding evasion (see below) |

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

## Profanity filter

Strict, per Jitain. Lives in [`lib/profanity.ts`](../lib/profanity.ts) (`containsProfanity`), pure and
dependency-free so the mobile app reuses the exact same rules; covered by
[`lib/profanity.test.ts`](../lib/profanity.test.ts). Two lists, to dodge the *Scunthorpe problem*
(rude fragments hiding inside innocent words):
- **Substring-banned** — severe slurs / strong profanity that never appear inside an ordinary word,
  matched *anywhere* (so `fuckbaloo`, `xxniggerxx` are caught).
- **Word-banned** — short/mild terms that *do* live inside normal words (`ass`→class, `cum`→cucumber,
  `anal`→analysis, `sex`→sussex), matched only as a whole hyphen-token or the whole handle, so
  `analysis` and `class-of-99` stay allowed while a bare `ass` or `sex` handle is blocked.

Evasion handling: leetspeak digits fold to letters (`sh1t`→shit) and repeated letters collapse
(`fuuuck`→fuck) before matching. It's a strict heuristic, not a guarantee — extend by adding a term to
the right list.

## Errors the user sees

Each failure returns one friendly line (no raw errors), shown live on the welcome screen:
- length → "Handles are 3–20 characters."
- charset → "Use only lowercase letters, numbers and hyphens."
- edges → "Hyphens can't start, end, or repeat."
- reserved → "That handle is reserved — pick another."
- profanity → "That handle isn't allowed — please choose another."
- taken → "That handle's taken — try another." (409, from the uniqueness check)

## Decisions for the team

These are choices, not bugs — worth a quick 👍 / change:
1. **Underscores:** intentionally **not** allowed (keeps handles URL-clean). Add them? *(proposed: no)*
2. **Profanity / slurs:** **filtered** (Jitain: strict) — curated two-list blocklist in
   `lib/profanity.ts` with leetspeak/padding evasion handling. Adjust strictness by editing the lists.
3. **All-numeric handles** (e.g. `12345`): currently **allowed** (no clash — profile URLs use the
   handle, internal IDs are UUIDs). Block them? *(proposed: allow)*
4. **Handle changes:** the API already supports re-setting your own handle; we have **not** added a
   cooldown or an old-handle redirect. *(proposed: fine for beta; revisit if squatting appears.)*
