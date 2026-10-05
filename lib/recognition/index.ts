// The recognition-engine connector (web-side consumption of Igor's shared engine). One entry point:
// `analyseViaEngine` resolves an identity → a catalog match → a full breakdown in OUR shapes. Every
// non-success is a typed reason so the caller (behind the launch feature flag) can fall back to the
// web's own Claude pipeline — no dead ends. Nothing here is wired into the live flow yet; this is the
// groundwork + what the compare view consumes.

import { adaptExplain, type EngineAnalysis } from "./adapt";
import { explainProduct, findProduct, recognitionEnabled } from "./client";
import type { ExplainResponse } from "./types";

export type { EngineAnalysis } from "./adapt";
export { recognitionEnabled } from "./client";
export { adaptExplain } from "./adapt";

export type EngineResult =
  | { ok: true; analysis: EngineAnalysis; raw: ExplainResponse }
  // disabled: keys unset · not_found / disambiguation: the engine can't (yet) pin one product ·
  // error: timeout / network / bad response. The caller falls back the same way for all of them.
  | { ok: false; reason: "disabled" | "not_found" | "disambiguation" | "error" };

export async function analyseViaEngine(input: {
  barcode?: string;
  brand?: string;
  productName?: string;
  locale?: string;
}): Promise<EngineResult> {
  if (!recognitionEnabled()) return { ok: false, reason: "disabled" };

  const find = await findProduct(input);
  if (!find) return { ok: false, reason: "error" };
  if (find.status === "not_found") return { ok: false, reason: "not_found" };
  // Disambiguation (several candidates) isn't auto-resolved yet — the web falls back for now. A later
  // slice can surface candidates or pick the best by confidence + has_ingredients.
  if (find.status === "disambiguation") return { ok: false, reason: "disambiguation" };

  const explain = await explainProduct({ variantId: find.variant_id, locale: input.locale ?? "en" });
  if (!explain) return { ok: false, reason: "error" };

  return { ok: true, analysis: adaptExplain(explain), raw: explain };
}
