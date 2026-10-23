// Share-card hero PROMPT builder (framework-agnostic, pure). A product's flat packshot
// (products.image_url) is turned into one warm, on-brand "presented product" scene for the social
// share cards — the product(s) on cream marble in soft daylight, clutter removed. This file owns ONLY
// the text prompt + which packshots to feed; the actual image call lives in the generation job
// (scripts/generate-heroes.ts) so lib/ stays portable (no image-API dependency here).
//
// Proven 2026-10 against Higgsfield `marketing_studio_image` (4:5 / 9:16, ~2 credits & ~30s/render):
// it cleans messy Open Food Facts shop-shelf photos into a studio still life. The aesthetic is Baloo's
// "Quiet Field Guide": warm cream background, soft natural light, no props clutter, labels kept
// faithful. See docs/SHARE_CARDS.md. The prompt NEVER invents claims or verdicts — it only restages the
// real packaging (score-free guardrail: this is presentation, not judgment).

export type HeroRatio = "4:5" | "9:16" | "1:1";

export type HeroProductRef = {
  name: string;
  brand?: string | null;
  /** The source packshot (OFF image_front_url / scan). Fed to the model as a reference to preserve
   *  the real packaging. Required — no packshot, no faithful hero. */
  packshotUrl: string;
};

export type HeroInput = {
  kind: "product" | "list";
  ratio: HeroRatio;
  /** Up to ~4 products. A product hero has one; a list hero composes its top products into one scene. */
  products: HeroProductRef[];
};

const MAX_PRODUCTS_IN_SCENE = 4;

/** Human phrase for one product: "a bottle of Coca-Cola Zero" style — brand + name, no size noise. */
function describe(p: HeroProductRef): string {
  const brand = (p.brand ?? "").trim();
  const name = p.name.trim();
  // Avoid "Coca-Cola Coca-Cola Zero" when the name already starts with the brand.
  if (brand && !name.toLowerCase().startsWith(brand.toLowerCase())) return `${brand} ${name}`;
  return name || brand;
}

/** Join product descriptions as an English list ("A, B and C"). */
function listProducts(products: HeroProductRef[]): string {
  const names = products.slice(0, MAX_PRODUCTS_IN_SCENE).map(describe).filter(Boolean);
  if (names.length <= 1) return names[0] ?? "the product";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Pick up to `max` products for a list hero, preferring DISTINCT brands so the scene shows variety —
 *  a list whose top rows are three Coke variants shouldn't render three identical bottles. Keeps label
 *  order; only repeats a brand if there aren't enough distinct ones to fill `max`. */
export function pickHeroProducts<T extends { brand?: string | null }>(products: T[], max = 4): T[] {
  const seen = new Set<string>();
  const distinct: T[] = [];
  const rest: T[] = [];
  for (const p of products) {
    // Dedupe on the FIRST brand token so messy variants collapse: "Coca-Cola", "Coca cola zero" and
    // "Coca Cola Zero Sugar" all key on "coca" → one Coke in the scene, leaving room for other brands.
    const key = (p.brand ?? "").trim().toLowerCase().split(/[\s\-/]+/)[0] ?? "";
    if (key && !seen.has(key)) {
      seen.add(key);
      distinct.push(p);
    } else {
      rest.push(p);
    }
  }
  return [...distinct, ...rest].slice(0, max);
}

/** The reference packshot URLs the generator should pass to the model (deduped, capped). */
export function heroReferenceUrls(input: HeroInput): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const p of input.products) {
    if (p.packshotUrl && !seen.has(p.packshotUrl)) {
      seen.add(p.packshotUrl);
      urls.push(p.packshotUrl);
    }
    if (urls.length >= MAX_PRODUCTS_IN_SCENE) break;
  }
  return urls;
}

/** Build the generation prompt for a product or list hero. Pure: same input → same prompt. */
export function buildHeroPrompt(input: HeroInput): string {
  const subject = listProducts(input.products);
  const grouping =
    input.products.length > 1
      ? `the products arranged together as a neat group — ${subject}`
      : `a single product: ${subject}`;

  return [
    `Editorial product still life: ${grouping},`,
    "presented on a warm cream marble surface in soft natural daylight from the left, with gentle, long, soft shadows.",
    // Strong preservation clause: image-edit models (gpt-image-1 especially) will otherwise re-draw and
    // garble the packaging. Tell it to treat this as a background/lighting restage, NOT a redraw.
    "Reproduce each product EXACTLY as in the reference photos: keep every logo, label, wording, font and colour identical, crisp and unchanged — do not redraw, re-letter, translate, invent or stylise any text on the packaging.",
    "Change only the surface, background and lighting around the products.",
    "Calm, premium, boutique still-life look; warm cream-beige seamless background with generous negative space above the products.",
    "Studio-clean: no shelves, no price tags, no clutter, no people, no added text, no logos other than the products' own.",
    "Magazine-quality.",
  ].join(" ");
}
