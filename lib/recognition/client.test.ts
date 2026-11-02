import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { recognitionEnabled, engineFirstEnabled } from "./client";

// The rollout gate for the engine swap (Slice A). It must be OFF unless the keys are present AND
// ENGINE_FIRST=1, so the live flow stays on the web's own pipeline until we explicitly flip it.
const KEYS = ["BALOO_RECOGNITION_ANON_KEY", "BALOO_RECOGNITION_KEY", "ENGINE_FIRST"] as const;

describe("engineFirstEnabled (rollout gate)", () => {
  let saved: Record<string, string | undefined>;
  beforeEach(() => {
    saved = {};
    for (const k of KEYS) saved[k] = process.env[k];
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  const setKeys = (on: boolean) => {
    if (on) {
      process.env.BALOO_RECOGNITION_ANON_KEY = "anon";
      process.env.BALOO_RECOGNITION_KEY = "key";
    } else {
      delete process.env.BALOO_RECOGNITION_ANON_KEY;
      delete process.env.BALOO_RECOGNITION_KEY;
    }
  };

  it("off when keys are absent, even with ENGINE_FIRST=1", () => {
    setKeys(false);
    process.env.ENGINE_FIRST = "1";
    expect(recognitionEnabled()).toBe(false);
    expect(engineFirstEnabled()).toBe(false);
  });

  it("off when keys present but ENGINE_FIRST unset", () => {
    setKeys(true);
    delete process.env.ENGINE_FIRST;
    expect(recognitionEnabled()).toBe(true);
    expect(engineFirstEnabled()).toBe(false);
  });

  it("off when ENGINE_FIRST is any value other than '1'", () => {
    setKeys(true);
    process.env.ENGINE_FIRST = "0";
    expect(engineFirstEnabled()).toBe(false);
  });

  it("on only with keys AND ENGINE_FIRST=1", () => {
    setKeys(true);
    process.env.ENGINE_FIRST = "1";
    expect(engineFirstEnabled()).toBe(true);
  });
});
