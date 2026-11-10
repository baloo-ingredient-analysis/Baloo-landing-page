import { describe, it, expect } from "vitest";
import { parseEnabledProviders } from "./oauthProviders";

describe("parseEnabledProviders", () => {
  it("defaults to Google alone when the var is absent or empty", () => {
    expect(parseEnabledProviders(undefined).map((p) => p.id)).toEqual(["google"]);
    expect(parseEnabledProviders("").map((p) => p.id)).toEqual(["google"]);
  });

  it("enables the named providers", () => {
    expect(parseEnabledProviders("google,apple,facebook").map((p) => p.id)).toEqual([
      "google",
      "apple",
      "facebook",
    ]);
  });

  it("keeps display order regardless of the var's order, and tolerates spacing/case", () => {
    expect(parseEnabledProviders("FACEBOOK , google").map((p) => p.id)).toEqual([
      "google",
      "facebook",
    ]);
  });

  it("drops unknown names and de-dupes", () => {
    expect(parseEnabledProviders("google,instagram,google").map((p) => p.id)).toEqual(["google"]);
  });

  it("falls back to Google when the var matches nothing supported", () => {
    expect(parseEnabledProviders("instagram,tiktok").map((p) => p.id)).toEqual(["google"]);
  });
});
