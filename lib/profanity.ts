// Profanity filter for usernames (Jitain: "very strict"). Pure + dependency-free so the mobile app
// reuses the exact same rules. Runs AFTER the charset check, so input is already [a-z0-9-] lowercase.
//
// Two lists, on purpose — the classic Scunthorpe problem is that short rude fragments hide inside
// innocent words (class, cucumber, analysis, title, sussex), so we can't just substring-match
// everything:
//
//  - SUBSTRING_BANNED — severe slurs and strong profanity that essentially never appear inside an
//    ordinary word. Matched ANYWHERE, so evasive padding ("xxniggerxx", "fuckbaloo") is still caught.
//  - WORD_BANNED — shorter / milder terms that DO live inside normal words. Matched only as a whole
//    hyphen-token or the whole handle, so "analysis", "class-of-99" and "sussex" stay allowed while a
//    bare "ass", "anal" or "sex" handle is blocked.
//
// Evasion handling: leetspeak digits are folded to letters (sh1t → shit) and runs of a repeated
// letter are collapsed (fuuuck → fuck) before matching. This is a heuristic, not a guarantee — it is
// intentionally strict and easy to extend by adding a term to the right list.

// Severe: safe to match as a substring anywhere in the handle.
const SUBSTRING_BANNED: readonly string[] = [
  "fuck", "motherfuck", "shit", "bullshit", "bitch", "bastard", "pussy", "slut", "whore",
  "cunt", "faggot", "asshole", "dumbass", "jackass", "dickhead", "cocksuck",
  // slurs
  "nigger", "nigga", "kike", "chink", "gook", "wetback", "beaner", "tranny", "retard",
  // sexual / explicit
  "porn", "rape", "rapist", "molest", "pedo", "pedophile", "paedophile", "penis", "vagina",
  "jizz", "wank", "twat", "bollock", "dildo", "blowjob", "handjob", "cumshot", "boner",
  // hate
  "nazi", "hitler",
];

// Milder or short: only blocked as a standalone hyphen-token or the whole handle, never mid-word.
const WORD_BANNED: readonly string[] = [
  "ass", "anal", "arse", "cum", "tit", "tits", "sex", "cock", "dick", "prick", "crap",
  "damn", "hell", "fag", "hoe", "homo", "coon", "spic", "wop", "jap", "dyke", "shag",
  "milf", "orgy", "boob", "boobs", "nude", "semen", "turd", "piss",
];

const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g",
};

function deLeet(s: string): string {
  return s.replace(/[01345789]/g, (d) => LEET[d] ?? d);
}

// Collapse runs of 2+ of the same character to one ("fuuuck" → "fuck", "class" → "clas"). Only used
// for the substring pass, and only compared against the wordlists, so collapsing an innocent double
// letter is harmless.
function collapse(s: string): string {
  return s.replace(/(.)\1+/g, "$1");
}

/** True if the handle (already lowercase, [a-z0-9-]) contains disallowed language. */
export function containsProfanity(handle: string): boolean {
  const deleeted = deLeet(handle);

  // Substring pass: strip hyphens, fold leet, collapse repeats, then scan.
  const flat = collapse(deleeted.replace(/-/g, ""));
  const flatRaw = deleeted.replace(/-/g, "");
  if (SUBSTRING_BANNED.some((w) => flat.includes(w) || flatRaw.includes(w))) return true;

  // Whole-word pass: each hyphen-token and the whole de-hyphenated handle, raw + collapsed.
  const tokens = new Set<string>();
  for (const t of deleeted.split("-")) {
    if (!t) continue;
    tokens.add(t);
    tokens.add(collapse(t));
  }
  tokens.add(flatRaw);
  tokens.add(flat);
  return WORD_BANNED.some((w) => tokens.has(w));
}
