import { describe, it, expect } from "vitest";
import { containsProfanity } from "./profanity";

describe("containsProfanity — blocks", () => {
  it("catches severe slurs / strong profanity anywhere in the handle", () => {
    for (const h of ["fuckbaloo", "xxniggerxx", "the-bitch", "faggot99", "pornhub", "cumshot"]) {
      expect(containsProfanity(h)).toBe(true);
    }
  });

  it("catches short/mild terms as a standalone token or whole handle", () => {
    for (const h of ["ass", "anal", "sex", "big-ass", "cool-sex-tips", "anal-time"]) {
      expect(containsProfanity(h)).toBe(true);
    }
  });

  it("sees through leetspeak digit swaps", () => {
    for (const h of ["sh1t", "b1tch", "fuck", "n1gger", "d1ck-head"]) {
      expect(containsProfanity(h)).toBe(true);
    }
  });

  it("sees through repeated-letter padding", () => {
    for (const h of ["fuuuck", "shiiit", "biiitch"]) {
      expect(containsProfanity(h)).toBe(true);
    }
  });
});

describe("containsProfanity — allows (Scunthorpe: rude fragments inside innocent words)", () => {
  it("does not block ordinary words that merely contain a short fragment", () => {
    for (const h of [
      "class-of-99", // contains "ass"
      "grassland",
      "cucumber", // contains "cum"
      "document", // contains "cum"
      "analysis", // contains "anal"
      "canal-street",
      "competitive", // contains "tit"
      "constitution",
      "sussex", // contains "sex"
      "essex",
      "peacock", // contains "cock"
      "shell-cottage", // contains "hell"
      "hello-world", // contains "hell"
      "scrappy", // contains "crap"
      "homogeneous", // contains "homo"
      "raccoon", // contains "coon"
      "passionfruit", // contains "pass"/"ass"
    ]) {
      expect(containsProfanity(h)).toBe(false);
    }
  });

  it("leaves normal handles alone", () => {
    for (const h of ["miquel", "oat-lover-99", "baloo-dev", "jitain", "best-breakfast"]) {
      expect(containsProfanity(h)).toBe(false);
    }
  });
});
