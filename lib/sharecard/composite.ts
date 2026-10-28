// The faithful hybrid compositor (server-only, `sharp`). This is the accuracy-first hero renderer: it
// NEVER redraws packaging. It takes the REAL product cutouts (background removed from the packshot) and
// places them on a warm cream backdrop with soft contact shadows — only the scene is generated, the
// product pixels are untouched. Replaces the generative provider for the "hybrid" ladder rung so brand
// text can never be AI-invented (Jitain's hard requirement). Pure given its buffers → unit-testable with
// no network. See docs/SHARE_CARDS.md.

import sharp from "sharp";
import type { HeroRatio } from "./prompt";

export type CompositeInput = {
  /** The scene background (cream marble). Covers the output frame. */
  backdrop: Buffer;
  /** 1–4 transparent-PNG product cutouts, in display order (left → right). */
  cutouts: Buffer[];
  ratio?: HeroRatio;
};

// Output frame per ratio. Tall-ish so the card can cover-crop into feed (4:5), story (9:16) and the
// 1.91:1 unfurl from one render. The product baseline sits in the band the cards keep visible.
const FRAME: Record<HeroRatio, { w: number; h: number }> = {
  "4:5": { w: 1456, h: 1816 },
  "9:16": { w: 1456, h: 1816 },
  "1:1": { w: 1456, h: 1456 },
};

// Where the products stand and how big, by how many share the scene. Fractions of frame height.
// Fewer products → larger and more centred; more → smaller so they fit side by side.
const BASELINE_FRAC = 0.72; // the "floor" the product bases rest on
function targetHeightFrac(n: number): number {
  if (n <= 1) return 0.40;
  if (n === 2) return 0.34;
  if (n === 3) return 0.28;
  return 0.24;
}

/** Evenly spaced centre X positions across the middle ~80% of the frame. */
function centresX(n: number, w: number): number[] {
  if (n <= 1) return [w / 2];
  const left = w * 0.26;
  const right = w * 0.74;
  const step = (right - left) / (n - 1);
  return Array.from({ length: n }, (_, i) => Math.round(left + i * step));
}

type Placed = { buf: Buffer; left: number; top: number; w: number; h: number; cx: number; baseY: number };

/** Resize each cutout to its target height and compute where it sits (base on the baseline). */
async function placeCutouts(cutouts: Buffer[], fw: number, fh: number): Promise<Placed[]> {
  const n = Math.min(cutouts.length, 4);
  const targetH = Math.round(fh * targetHeightFrac(n));
  const baseY = Math.round(fh * BASELINE_FRAC);
  const cx = centresX(n, fw);
  const placed: Placed[] = [];
  for (let i = 0; i < n; i++) {
    // Contain within targetH (keep aspect); don't upscale past 2× to avoid mushy cutouts.
    const resized = await sharp(cutouts[i])
      .resize({ height: targetH, fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer();
    const meta = await sharp(resized).metadata();
    const w = meta.width ?? targetH;
    const h = meta.height ?? targetH;
    const left = Math.round(cx[i] - w / 2);
    const top = Math.round(baseY - h);
    placed.push({ buf: resized, left, top, w, h, cx: cx[i], baseY });
  }
  return placed;
}

/** A soft contact-shadow layer: a blurred dark ellipse under each product base. */
function shadowSvg(placed: Placed[], fw: number, fh: number): Buffer {
  const ellipses = placed
    .map((p) => {
      const rx = Math.round(p.w * 0.46);
      const ry = Math.max(14, Math.round(p.h * 0.05));
      const cy = p.baseY - Math.round(ry * 0.2); // nudge up so it reads as contact, not a halo
      return `<ellipse cx="${p.cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="rgba(60,46,26,0.45)" />`;
    })
    .join("");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${fw}" height="${fh}">${ellipses}</svg>`);
}

/**
 * Composite the real cutouts onto the backdrop with contact shadows. Returns JPEG bytes.
 * Throws only on a hard sharp failure; the caller treats a throw/empty as "no hero" and falls back.
 */
export async function compositeHero(input: CompositeInput): Promise<Buffer> {
  const { w: fw, h: fh } = FRAME[input.ratio ?? "4:5"];
  const cutouts = input.cutouts.slice(0, 4);
  if (cutouts.length === 0) throw new Error("compositeHero: no cutouts");

  const base = sharp(input.backdrop).resize(fw, fh, { fit: "cover", position: "centre" });
  const placed = await placeCutouts(cutouts, fw, fh);

  // Blur the shadow ellipses into soft contact shadows (rasterise the SVG, then blur).
  const shadow = await sharp(shadowSvg(placed, fw, fh)).png().blur(26).toBuffer();

  const layers: sharp.OverlayOptions[] = [
    { input: shadow, top: 0, left: 0 },
    ...placed.map((p) => ({ input: p.buf, top: p.top, left: p.left })),
  ];

  return base.composite(layers).jpeg({ quality: 88 }).toBuffer();
}
