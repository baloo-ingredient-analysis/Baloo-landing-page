import { describe, it, expect } from "vitest";
import { validateHandle, normalizeHandle, RESERVED_HANDLES } from "./handle";

describe("validateHandle", () => {
  it("accepts a normal handle", () => {
    const r = validateHandle("miquel");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.handle).toBe("miquel");
  });

  it("accepts internal hyphens and digits", () => {
    expect(validateHandle("oat-lover-99").ok).toBe(true);
    expect(validateHandle("abc").ok).toBe(true); // min length
    expect(validateHandle("a".repeat(20)).ok).toBe(true); // max length
  });

  it("normalises case and whitespace before validating", () => {
    const r = validateHandle("  Miquel  ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.handle).toBe("miquel");
    expect(normalizeHandle("ADMIN")).toBe("admin");
  });

  it("rejects too short / too long", () => {
    expect(validateHandle("ab")).toMatchObject({ ok: false, error: "length" });
    expect(validateHandle("a".repeat(21))).toMatchObject({ ok: false, error: "length" });
  });

  it("rejects invalid characters (spaces, underscores, symbols, uppercase-only input aside)", () => {
    expect(validateHandle("has space")).toMatchObject({ ok: false, error: "charset" });
    expect(validateHandle("under_score")).toMatchObject({ ok: false, error: "charset" });
    expect(validateHandle("emoji😀ok")).toMatchObject({ ok: false, error: "charset" });
    expect(validateHandle("dot.name")).toMatchObject({ ok: false, error: "charset" });
  });

  it("rejects leading / trailing / doubled hyphens", () => {
    expect(validateHandle("-abc")).toMatchObject({ ok: false, error: "edges" });
    expect(validateHandle("abc-")).toMatchObject({ ok: false, error: "edges" });
    expect(validateHandle("a--b")).toMatchObject({ ok: false, error: "edges" });
  });

  it("rejects reserved words (routes, roles, brand) that are long enough to otherwise be valid", () => {
    for (const w of ["admin", "api", "settings", "baloo", "official", "support"]) {
      expect(validateHandle(w)).toMatchObject({ ok: false, error: "reserved" });
    }
  });

  it("short reserved route names are blocked too (by the length rule, before reserved)", () => {
    // "u" and "p" are reserved paths but under the 3-char minimum, so they can never be claimed.
    expect(validateHandle("u").ok).toBe(false);
    expect(validateHandle("p").ok).toBe(false);
  });

  it("reserves exact matches only, not prefixes", () => {
    expect(RESERVED_HANDLES.has("baloo")).toBe(true);
    expect(validateHandle("baloo-dev").ok).toBe(true); // seed handles still pass
    expect(validateHandle("baloo-friend").ok).toBe(true);
  });

  it("catches a reserved word disguised with unicode look-alikes", () => {
    // NFKC folds the fullwidth 'ａｄｍｉｎ' back to 'admin'
    expect(validateHandle("ａｄｍｉｎ")).toMatchObject({ ok: false, error: "reserved" });
  });

  it("rejects profanity (incl. leetspeak), but keeps innocent look-alike words", () => {
    expect(validateHandle("fuckbaloo")).toMatchObject({ ok: false, error: "profanity" });
    expect(validateHandle("sh1t-head")).toMatchObject({ ok: false, error: "profanity" });
    expect(validateHandle("big-ass")).toMatchObject({ ok: false, error: "profanity" });
    // Scunthorpe guard: these are fine
    expect(validateHandle("class-of-99").ok).toBe(true);
    expect(validateHandle("analyst").ok).toBe(true);
  });
});
