// Spike: exercise Igor's partner recognition API from our backend (docs/PARTNER_RECOGNITION_API.md).
// Throwaway — proves the keys work and shows real response shapes before we decide how the web adopts
// these endpoints. Reads keys from .env.local (never hardcode them). Run: npm run test:recognition [barcode]
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env.development.local" });

const BASE = process.env.BALOO_RECOGNITION_URL ?? "https://rahjnurtpwygtaayzfgi.supabase.co/functions/v1";
const ANON = process.env.BALOO_RECOGNITION_ANON_KEY ?? "";
const KEY = process.env.BALOO_RECOGNITION_KEY ?? "";

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON, // Supabase gateway (public anon JWT)
      "x-recognition-key": KEY, // the real partner lock — server-side only
    },
    body: JSON.stringify(body),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, json };
}

async function main() {
  const barcode = process.argv[2] ?? "3017620422003"; // Nutella, as a known-global default

  if (!ANON || !KEY) {
    console.error("✗ Missing keys. Add these to .env.local:");
    console.error("    BALOO_RECOGNITION_ANON_KEY=eyJ…   (the public anon JWT)");
    console.error("    BALOO_RECOGNITION_KEY=baloo_website_…   (the partner key)");
    process.exit(1);
  }
  console.log(`base: ${BASE}`);
  console.log(`anon: ${ANON.slice(0, 8)}…  key: ${KEY.slice(0, 14)}…\n`); // never print full secrets

  // 1) find-ingredients by barcode
  console.log(`① find-ingredients  barcode=${barcode}`);
  const find = await post("find-ingredients", { barcode });
  console.log(`   → ${find.status}`, JSON.stringify(find.json)?.slice(0, 400), "\n");
  if (find.status === 401) return console.error("✗ 401 Unauthorized — check the recognition key.");
  if (find.status === 503) return console.error("✗ 503 — partner API not configured (ask Igor).");

  // 2) explain-ingredients — names-only path (always works, no catalog row needed)
  console.log(`② explain-ingredients  names=[sugar, palm oil, soy lecithin]`);
  const explainNames = await post("explain-ingredients", { ingredients: ["sugar", "palm oil", "soy lecithin"] });
  console.log(`   → ${explainNames.status}`, JSON.stringify(explainNames.json)?.slice(0, 500), "\n");

  // 3) explain-ingredients — full path, if the barcode resolved to a variant
  const variantId = (find.json as { status?: string; variant_id?: string })?.variant_id;
  if (variantId) {
    console.log(`③ explain-ingredients  variant_id=${variantId}  locale=en  ← the convergence path`);
    const explain = await post("explain-ingredients", { variant_id: variantId, locale: "en" });
    const first = (explain.json as { ingredients?: Record<string, unknown>[] })?.ingredients?.[0];
    console.log(`   → ${explain.status}`);
    if (first) {
      // Eyeball: is it ENGLISH, and does it carry per-product CONTEXT (not just ingredient-level)?
      console.log(`   first ingredient:`, JSON.stringify(first, null, 2).slice(0, 900));
      console.log(`   has product_context: ${"product_context" in first}  has significance_note: ${"significance_note" in first}`);
    } else {
      console.log(`   `, JSON.stringify(explain.json)?.slice(0, 400));
    }
    console.log();
  } else {
    console.log("③ skipped — find-ingredients returned no variant_id (status above shows why).\n");
  }

  console.log("done.");
}

main().catch((e) => {
  console.error("✗ request failed:", e);
  process.exit(1);
});
