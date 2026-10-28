import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { compositeHero } from "./composite";

// Tiny in-memory inputs so the test needs no assets or network.
const solid = (w: number, h: number, rgb: { r: number; g: number; b: number }) =>
  sharp({ create: { width: w, height: h, channels: 3, background: rgb } }).jpeg().toBuffer();
const cutout = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 4, background: { r: 200, g: 40, b: 40, alpha: 1 } } })
    .png()
    .toBuffer();

describe("compositeHero", () => {
  it("renders a 4:5 JPEG at the frame size from 1 cutout", async () => {
    const out = await compositeHero({
      backdrop: await solid(400, 500, { r: 244, g: 237, b: 227 }),
      cutouts: [await cutout(200, 300)],
      ratio: "4:5",
    });
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(1456);
    expect(meta.height).toBe(1816);
  });

  it("composites up to 4 products (extra are ignored) and stays the frame size", async () => {
    const cuts = await Promise.all([cutout(200, 300), cutout(180, 260), cutout(220, 280), cutout(160, 320), cutout(200, 200)]);
    const out = await compositeHero({ backdrop: await solid(400, 500, { r: 244, g: 237, b: 227 }), cutouts: cuts });
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(1456);
    expect(meta.height).toBe(1816);
  });

  it("renders a 9:16 frame", async () => {
    const out = await compositeHero({
      backdrop: await solid(400, 500, { r: 244, g: 237, b: 227 }),
      cutouts: [await cutout(200, 300)],
      ratio: "9:16",
    });
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(1456);
    expect(meta.height).toBe(1816);
  });

  it("throws with no cutouts (caller treats a throw as 'no hero' → fallback)", async () => {
    await expect(
      compositeHero({ backdrop: await solid(400, 500, { r: 1, g: 1, b: 1 }), cutouts: [] }),
    ).rejects.toThrow();
  });
});
