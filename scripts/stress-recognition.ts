// Stress-test Igor's recognition API (docs/PARTNER_RECOGNITION_API.md) against REAL products from our
// own catalog — the "Miquel stress-tests the endpoints" step. For each barcode: find-ingredients →
// explain-ingredients(locale:"en"). Reports status, the name/category Igor returns vs what we have,
// ingredient count, and whether the first ingredient name came back in English. Throwaway harness;
// keys from .env.local; prints only truncated key prefixes. Run: npm run stress:recognition
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

async function post(path: string, body: unknown) {
  try {
    const res = await fetch(`${BASE}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON, "x-recognition-key": KEY },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json().catch(() => null)) as Record<string, unknown> | null };
  } catch (e) {
    return { status: 0, json: { error: String(e) } as Record<string, unknown> };
  }
}

const looksNonEnglish = (s: string | null) => !!s && /[àâäéèêëïîôöùûüçñ]/i.test(s);

async function main() {
  if (!ANON || !KEY) {
    console.error("✗ Missing keys — add BALOO_RECOGNITION_ANON_KEY and BALOO_RECOGNITION_KEY to .env.local");
    process.exit(1);
  }
  console.log(`stress-testing ${PRODUCTS.length} real catalog products against find-ingredients + explain(locale:en)\n`);

  const rows: Record<string, unknown>[] = [];
  for (const p of PRODUCTS) {
    const find = await post("find-ingredients", { barcode: p.barcode });
    const j = find.json ?? {};
    const status = (j.status as string) ?? `HTTP ${find.status}`;
    let ing: number | null = null;
    let firstName: string | null = null;
    let hasContext: boolean | null = null;

    if (status === "found" && j.variant_id) {
      const ex = await post("explain-ingredients", { variant_id: j.variant_id, locale: "en" });
      const items = (ex.json?.ingredients as Record<string, unknown>[] | undefined) ?? [];
      ing = items.length;
      firstName = (items[0]?.canonical_name as string) ?? null;
      hasContext = items[0] ? "product_context" in items[0] : null;
    }
    rows.push({ ...p, status, offName: j.display_name ?? "", cat: j.category ?? "", ing, firstName, hasContext });

    const bits = [
      `${status}`,
      j.display_name ? `"${j.display_name}"` : "",
      j.category ? `cat:${j.category}` : "",
      ing != null ? `${ing} ing, 1st="${firstName}"${looksNonEnglish(firstName) ? " ⚠︎non-EN" : ""}, context=${hasContext}` : "",
    ].filter(Boolean);
    console.log(`• ${p.brand} — ${p.name}  [${p.barcode}]\n    → ${bits.join("  |  ")}`);
  }

  const by = (s: string) => rows.filter((r) => r.status === s).length;
  const nonEng = rows.filter((r) => looksNonEnglish(r.firstName as string | null));
  console.log(`\n=== summary ===`);
  console.log(`found ${by("found")} · disambiguation ${by("disambiguation")} · not_found ${by("not_found")} · of ${rows.length}`);
  console.log(`first-ingredient name looks non-English: ${nonEng.length}${nonEng.length ? ` (${nonEng.map((r) => r.firstName).join(", ")})` : ""}`);
  console.log(`\nflag-to-Igor candidates: not_found store-brands, non-EN names, empty categories.`);
}

main().catch((e) => {
  console.error("✗ failed:", e);
  process.exit(1);
});
