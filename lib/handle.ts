// Handle (username) rules — pure, portable, the ONE source of truth (docs/USERNAME_RULES.md).
// Used by the API (app/api/profile), the welcome UI, and the tests. Keep it dependency-free so the
// mobile app can reuse the exact same rules later.
//
// Validation runs only when a handle is SET or CHANGED — existing handles are grandfathered.

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;

export type HandleError = "length" | "charset" | "edges" | "reserved";

export type HandleResult =
  | { ok: true; handle: string }
  | { ok: false; error: HandleError; message: string };

// Reserved: route names (so a handle can never shadow or be confused with a path), roles/impersonation
// ("admin", "official", "baloo"…), and generic account words. Exact matches only — "baloo" is blocked
// but "baloo-dev" is fine. Lowercase; validation normalises before comparing.
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  // routes / reserved paths
  "api", "app", "admin", "auth", "welcome", "settings", "discover", "explore", "feed",
  "list", "lists", "p", "u", "new", "search", "og", "home",
  "login", "logout", "signin", "signup", "sign-in", "sign-up",
  "about", "help", "support", "contact", "terms", "privacy", "legal", "blog", "docs",
  "static", "public", "assets", "favicon", "robots", "sitemap",
  // account / generic
  "profile", "profiles", "user", "users", "account", "accounts", "me", "you", "null", "undefined",
  "root", "system", "everyone", "anonymous", "guest",
  // roles / impersonation
  "mod", "moderator", "staff", "official", "team", "security", "abuse", "report",
  // brand
  "baloo", "balooapp", "baloolife", "baloofood", "baloo-team", "baloo-official",
]);

// NFKC folds look-alike unicode to its canonical form (so a fancy-font "admin" can't sneak past the
// reserved check), then trim + lowercase to match how the UI and DB store handles.
export function normalizeHandle(raw: string): string {
  return raw.normalize("NFKC").trim().toLowerCase();
}

const CHARSET_RE = /^[a-z0-9-]+$/;

export function validateHandle(raw: string): HandleResult {
  const handle = normalizeHandle(raw);

  if (handle.length < HANDLE_MIN || handle.length > HANDLE_MAX) {
    return { ok: false, error: "length", message: `Handles are ${HANDLE_MIN}–${HANDLE_MAX} characters.` };
  }
  if (!CHARSET_RE.test(handle)) {
    return { ok: false, error: "charset", message: "Use only lowercase letters, numbers and hyphens." };
  }
  if (handle.startsWith("-") || handle.endsWith("-") || handle.includes("--")) {
    return { ok: false, error: "edges", message: "Hyphens can't start, end, or repeat." };
  }
  if (RESERVED_HANDLES.has(handle)) {
    return { ok: false, error: "reserved", message: "That handle is reserved — pick another." };
  }

  return { ok: true, handle };
}
