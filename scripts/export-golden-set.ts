// One-off: export a "golden set" of {barcode → expected identity + ingredient list} from our web
// catalog, to hand Igor as an accuracy benchmark for find-ingredients / explain-ingredients. Reads our
// DB only (no calls to his system). Run: npx -y tsx scripts/export-golden-set.ts
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env.development.local" });
import postgres from "postgres";
import { writeFileSync } from "node:fs";

// Output path: first CLI arg, else off-golden-set.json in the repo root (gitignored — a generated
// artifact, not source). Regenerate any time: `npm run export:golden-set`.
const DEST = process.argv[2] ?? "off-golden-set.json";

async function main() {
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_PRISMA_URL;
  if (!url) {
    console.error("no DB url (DATABASE_URL / POSTGRES_URL…)");
    process.exit(1);
  }
  const sql = postgres(url, { prepare: false });

  const rows = await sql`
    select regexp_replace(p.canonical_key, '^barcode:', '') as barcode,
           p.brand, p.name, p.countries,
           (select array_agg(i.name order by i.rank)
              from ingredient_profile_items i
              join ingredient_profiles pr on pr.id = i.profile_id
             where pr.product_id = p.id and pr.is_active) as ingredients
    from products p
    where p.canonical_key like 'barcode:%'
      and exists (select 1 from ingredient_profiles pr
                  join ingredient_profile_items i2 on i2.profile_id = pr.id
                  where pr.product_id = p.id and pr.is_active)
    order by ('spain' = any(p.countries)) desc nulls last, p.created_at desc`;

  const out = {
    note:
      "Baloo web-catalog golden set: {barcode -> expected identity + ingredient list}. Ingredient names " +
      "are ENGLISH (from the web's own analysis). Use as a RESOLUTION + COVERAGE benchmark for " +
      "find-ingredients/explain: (1) the barcode should resolve to this product, (2) the returned " +
      "ingredient SET should roughly match (exact strings differ by language until name-localization " +
      "lands - compare counts / key ingredients, not literal text). Heavy on ES store-brands.",
    source: "baloo-web catalog (Supabase pppwlwelzhyizlphxcfp), vetted analyses",
    generated: new Date().toISOString().slice(0, 10),
    count: rows.length,
    cases: rows.map((r) => ({
      barcode: r.barcode,
      brand: r.brand,
      name: r.name,
      countries: r.countries ?? [],
      ingredient_count: Array.isArray(r.ingredients) ? r.ingredients.length : 0,
      ingredients: r.ingredients ?? [],
    })),
  };

  writeFileSync(DEST, JSON.stringify(out, null, 2));
  console.log(`wrote ${rows.length} cases -> ${DEST}`);
  await sql.end();
}

main().catch((e) => {
  console.error("export failed:", e);
  process.exit(1);
});
