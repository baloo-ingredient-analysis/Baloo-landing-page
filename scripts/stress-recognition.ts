// Stress-test Igor's recognition API (docs/PARTNER_RECOGNITION_API.md) against REAL products from our
// own catalog — the "Miquel stress-tests the endpoints" step. For each barcode: find-ingredients →
// explain-ingredients(locale:"en"). Reports status, the name/category Igor returns vs what we have,
// ingredient count, English-ness, AND (since 1 Oct 2026) the new fields the web now depends on:
// product_summary, nutrition + daily_reference (UK reference intake), and the processing_tag spread
// (natural/processed/artificial — informs the 2-vs-3 tag decision). Throwaway harness; keys from
// .env.local; prints only truncated key prefixes. Run: npm run stress:recognition
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env.development.local" });

const BASE = process.env.BALOO_RECOGNITION_URL ?? "https://rahjnurtpwygtaayzfgi.supabase.co/functions/v1";
const ANON = process.env.BALOO_RECOGNITION_ANON_KEY ?? "";
const KEY = process.env.BALOO_RECOGNITION_KEY ?? "";

// Pulled from our own catalog (barcode → what WE store), so this doubles as a convergence cross-check.
const PRODUCTS: { barcode: string; brand: string; name: string }[] = [
  { barcode: "8480000808585", brand: "Hacendado", name: "Hummus Classic" },
  { barcode: "8480000156044", brand: "Hacendado", name: "Gazpacho Tradicional" },
  { barcode: "8480000156488", brand: "Hacendado", name: "Almendra calcio" },
  { barcode: "8410762220059", brand: "Casa Tarradellas", name: "Pizza Fresca Jamón y Queso" },
  { barcode: "8410199021069", brand: "Doritos", name: "Doritos" },
  { barcode: "8425190231126", brand: "Capitán Maní", name: "Crema de cacahuete" },
  { barcode: "5449000265098", brand: "Coca-Cola", name: "Coca-Cola Energy" },
  { barcode: "5740700982972", brand: "Coca-Cola", name: "Coca Cola Zero" },
  { barcode: "8713576173031", brand: "Terrasana", name: "Chips salées" },
  { barcode: "24052115", brand: "La Villa", name: "Caldo de pollo" },
  { barcode: "20073138", brand: "Realvalle", name: "Lomo embuchado" },
  { barcode: "5024530005316", brand: "PIZZA EXPRESS", name: "American pepperoni" },
];

type Json = Record<string, unknown>;

async function post(path: string, body: unknown) {
  try {
    const res = await fetch(`${BASE}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON, "x-recognition-key": KEY },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json().catch(() => null)) as Json | null };
  } catch (e) {
    return { status: 0, json: { error: String(e) } as Json };
  }
}

const looksNonEnglish = (s: string | null) => !!s && /[àâäéèêëïîôöùûüçñ]/i.test(s);

async function main() {
  if (!ANON || !KEY) {
    console.error("✗ Missing keys — add BALOO_RECOGNITION_ANON_KEY and BALOO_RECOGNITION_KEY to .env.local");
    process.exit(1);
  }
  console.log(`stress-testing ${PRODUCTS.length} real catalog products against find-ingredients + explain(locale:en)\n`);

  const rows: Json[] = [];
  const tagTotals: Record<string, number> = { natural: 0, processed: 0, artificial: 0, other: 0 };
  let withSummary = 0;
  let withNutrition = 0;
  let withRefIntake = 0;

  for (const p of PRODUCTS) {
    const find = await post("find-ingredients", { barcode: p.barcode });
    const j = find.json ?? {};
    const status = (j.status as string) ?? `HTTP ${find.status}`;
    let ing: number | null = null;
    let firstName: string | null = null;
    let hasContext: boolean | null = null;
    let summary: string | null = null;
    let hasNutr = false;
    let hasRef = false;

    if (status === "found" && j.variant_id) {
      const ex = await post("explain-ingredients", { variant_id: j.variant_id, locale: "en" });
      const body = ex.json ?? {};
      const items = (body.ingredients as Json[] | undefined) ?? [];
      ing = items.length;
      firstName = (items[0]?.canonical_name as string) ?? null;
      hasContext = items[0] ? "product_context" in items[0] : null;
      summary = (body.product_summary as string) ?? null;
      const nutr = (body.nutrition as Json | null) ?? null;
      hasNutr = !!nutr;
      hasRef = !!(nutr && nutr.daily_reference);
      if (summary) withSummary++;
      if (hasNutr) withNutrition++;
      if (hasRef) withRefIntake++;
      for (const it of items) {
        const t = (it.processing_tag as string) ?? "";
        if (t in tagTotals) tagTotals[t]++;
        else tagTotals.other++;
      }
    }
    rows.push({ ...p, status, ing, firstName });

    const bits = [
      `${status}`,
      j.display_name ? `"${j.display_name}"` : "",
      j.category ? `cat:${j.category}` : "",
      ing != null ? `${ing} ing, 1st="${firstName}"${looksNonEnglish(firstName) ? " ⚠︎non-EN" : ""}, ctx=${hasContext}` : "",
      status === "found" ? `summary=${summary ? "✓" : "✗"} nutrition=${hasNutr ? "✓" : "✗"} refIntake=${hasRef ? "✓" : "✗"}` : "",
    ].filter(Boolean);
    console.log(`• ${p.brand} — ${p.name}  [${p.barcode}]\n    → ${bits.join("  |  ")}`);
    if (summary) console.log(`      summary: "${summary}"`);
  }

  const by = (s: string) => rows.filter((r) => r.status === s).length;
  const nonEng = rows.filter((r) => looksNonEnglish(r.firstName as string | null));
  const foundN = by("found");
  const totalTags = tagTotals.natural + tagTotals.processed + tagTotals.artificial + tagTotals.other;
  console.log(`\n=== summary ===`);
  console.log(`found ${foundN} · disambiguation ${by("disambiguation")} · not_found ${by("not_found")} · of ${rows.length}`);
  console.log(`new fields (of ${foundN} found): product_summary ${withSummary} · nutrition ${withNutrition} · daily_reference ${withRefIntake}`);
  console.log(`processing_tag spread (${totalTags} ingredients): natural ${tagTotals.natural} · processed ${tagTotals.processed} · artificial ${tagTotals.artificial}${tagTotals.other ? ` · other ${tagTotals.other}` : ""}`);
  console.log(`first-ingredient name looks non-English: ${nonEng.length}${nonEng.length ? ` (${nonEng.map((r) => r.firstName).join(", ")})` : ""}`);
  console.log(`\nflag-to-Igor candidates: not_found store-brands, non-EN names, empty categories, missing summary/nutrition on found products.`);
}

main().catch((e) => {
  console.error("✗ failed:", e);
  process.exit(1);
});
