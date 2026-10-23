// Packshot quality classifier — the gate in front of the hybrid hero compositor.
//
// The hybrid approach (generate a cream-marble backdrop, then composite the REAL product cutouts so the
// packaging text is never AI-invented — Jitain's hard requirement) only looks right when the source
// packshot is a true 3D studio product photo. Validated 2026-10 across varied lists: jars, bags, cartons
// and bottles (Nutella, Doritos, Gazpacho, Capitán Maní) composite beautifully; but a flat front-face
// label scan (Actimel multipack) reads as a pasted rectangle, and a serving-suggestion / lifestyle shot
// (a bowl of hummus) breaks entirely. Roughly half the Open Food Facts catalogue is messy, so we must
// SORT packshots before compositing — that's this file.
//
// Claude is the judge (same "Claude is the extraction layer, no hand-rolled parsers" philosophy as the
// rest of the pipeline): one cheap vision call grades the image. Framework-agnostic, optional-infra
// (no ANTHROPIC_API_KEY → null, caller degrades), best-effort (any error → null, never blocks a share).

import { z } from "zod";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { MODEL } from "../config";
import { pickHeroProducts } from "./prompt";

/**
 * How a source packshot reads, which decides how it can be used:
 *  - `studio_3d`  — a clean studio photo of the physical package with real depth/volume on a plain
 *                   background. Composites into the hybrid scene. The only grade that does.
 *  - `flat_scan`  — a straight-on, depthless scan of just the front face (reads as a 2D rectangle).
 *                   Labels are real, so it's fine shown FLAT on a tint card, but not in the 3D scene.
 *  - `lifestyle`  — a serving suggestion, prepared-food, in-hand, on-shelf or otherwise staged/cluttered
 *                   shot. Not a packshot; unusable for a card hero.
 *  - `unusable`   — blurry, placeholder ("image coming soon"), logo-only, too dark, or clearly the wrong
 *                   product. Unusable anywhere.
 */
export type PackshotGrade = "studio_3d" | "flat_scan" | "lifestyle" | "unusable";

export type PackshotQuality = {
  grade: PackshotGrade;
  /** Model confidence 0..1. */
  confidence: number;
  /** Short, neutral reason — for logs/debugging, never shown to users. */
  reason: string;
  /** Clean 3D packshot → safe to composite into the hybrid group scene. */
  usableForHybrid: boolean;
  /** 3D or flat scan → the packaging is faithful, so it's fine shown flat on a tint card. */
  usableAsFlatPackshot: boolean;
};

const MIN_CONFIDENCE = 0.5;

const schema = z.object({
  grade: z
    .enum(["studio_3d", "flat_scan", "lifestyle", "unusable"])
    .describe(
      "studio_3d: a clean studio photo of the physical PACKAGE with real depth/volume (you can see it " +
        "is a 3D object — jar, bottle, bag, carton, box, tin) on a plain white/neutral background, no " +
        "hands, no shelf, no scene. flat_scan: a flat, straight-on image of only the front face with no " +
        "depth — it looks like a 2D rectangle/label, not a photographed object. lifestyle: a serving " +
        "suggestion, prepared food, product held in a hand, on a shop shelf with price tags, a table " +
        "setting, or any staged/cluttered scene. unusable: blurry, a placeholder/'no image', logo only, " +
        "too dark, text-heavy, or clearly the wrong product.",
    ),
  confidence: z.number().min(0).max(1).describe("Your confidence in the grade, 0 to 1."),
  reason: z.string().describe("One short neutral clause explaining the grade (for logs, not users)."),
});

/** Grade a single packshot image. Null when the key is absent (optional-infra) or on any error. */
export async function classifyPackshot(imageUrl: string | null | undefined): Promise<PackshotQuality | null> {
  if (!process.env.ANTHROPIC_API_KEY || !imageUrl) return null;
  let url: URL;
  try {
    url = new URL(imageUrl);
  } catch {
    return null; // not a usable absolute URL
  }
  try {
    const { object } = await generateObject({
      model: anthropic(MODEL),
      schema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Grade this product image for use as a social share-card hero. We composite the REAL " +
                "product cutout onto a studio background, so we need a clean 3D studio packshot. Judge " +
                "ONLY the image type (lighting/background/whether it is the physical package in 3D), not " +
                "the product itself. Classify strictly per the schema.",
            },
            { type: "image", image: url },
          ],
        },
      ],
    });
    return finalize(object.grade, object.confidence, object.reason);
  } catch {
    return null; // best-effort — never break a share
  }
}

/** Derive the usability flags from a grade + confidence (pure; exported for the selector + tests). */
export function finalize(grade: PackshotGrade, confidence: number, reason: string): PackshotQuality {
  const confident = confidence >= MIN_CONFIDENCE;
  return {
    grade,
    confidence,
    reason,
    // A low-confidence "studio_3d" is treated as not-clean-enough to composite (fail safe).
    usableForHybrid: grade === "studio_3d" && confident,
    usableAsFlatPackshot: grade === "studio_3d" || grade === "flat_scan",
  };
}

// --- The fallback ladder (pure selection logic; unit-tested without the network) -----------------

export type HeroStrategy =
  | "hybrid" // compose the clean 3D packshots into one scene
  | "flat" // no clean 3D shot, but a faithful flat packshot → show it flat on a tint card
  | "brand"; // nothing usable → the generic flat brand card

export type GradedProduct<T> = { product: T; quality: PackshotQuality | null };

export type HeroPlan<T> = {
  strategy: HeroStrategy;
  /** The products to use for the chosen strategy (0 for `brand`, 1 for `flat`, 1..max for `hybrid`). */
  products: T[];
  /** false when the plan rests on products the classifier couldn't grade (key/outage) — a best-effort
   *  attempt that preserves the pre-classifier behaviour instead of regressing to a worse rung. */
  verified: boolean;
};

/**
 * Choose a hero strategy from graded products — the fallback ladder.
 *
 *  1. Any confidently-clean 3D packshots → `hybrid` with those (brand-deduped, capped at `max`).
 *  2. Else, if NONE could be graded (classifier off/outage) → attempt `hybrid` with the imaged ones
 *     anyway (`verified: false`) so we never regress below the old behaviour.
 *  3. Else, a faithful flat packshot exists → `flat` with the first such product.
 *  4. Else → `brand`.
 *
 * Pure: `products` preserves the caller's order; only `pickHeroProducts` reorders for brand variety.
 */
export function planHero<T extends { brand?: string | null }>(
  graded: GradedProduct<T>[],
  max = 4,
): HeroPlan<T> {
  const studio = graded.filter((g) => g.quality?.usableForHybrid).map((g) => g.product);
  if (studio.length > 0) {
    return { strategy: "hybrid", products: pickHeroProducts(studio, max), verified: true };
  }

  const ungraded = graded.filter((g) => g.quality === null).map((g) => g.product);
  if (ungraded.length > 0 && graded.every((g) => g.quality === null)) {
    // Total classifier outage: don't regress — try the hybrid on what we have, flagged unverified.
    return { strategy: "hybrid", products: pickHeroProducts(ungraded, max), verified: false };
  }

  const flat = graded.find((g) => g.quality?.usableAsFlatPackshot)?.product;
  if (flat) return { strategy: "flat", products: [flat], verified: true };

  return { strategy: "brand", products: [], verified: true };
}

/**
 * Classify each product's packshot (in parallel) and choose a hero strategy — the network-backed entry
 * point the hero-generation callers use. Best-effort: an ungraded product (key absent / transient error)
 * flows through `planHero`'s no-regression path. `max` caps the hybrid scene.
 */
export async function classifyAndPlanHero<T extends { packshotUrl: string; brand?: string | null }>(
  products: T[],
  max = 4,
): Promise<HeroPlan<T>> {
  const graded = await Promise.all(
    products.map(async (product) => ({ product, quality: await classifyPackshot(product.packshotUrl) })),
  );
  return planHero(graded, max);
}
