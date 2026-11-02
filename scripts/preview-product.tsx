// Local preview of the editorial product card → PNG. Dev only.
//   npx tsx scripts/preview-product.tsx <out.png>
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "fs";
import { productCard, type ProductCardRow } from "../lib/sharecard/productCard";

const F = (p: string) => readFileSync(new URL(`../lib/sharecard/fonts/${p}`, import.meta.url));
const fonts = [
  { name: "Playfair Display", data: F("PlayfairDisplay-700.ttf"), weight: 700, style: "normal" },
  { name: "Playfair Display", data: F("PlayfairDisplay-600.ttf"), weight: 600, style: "normal" },
  { name: "Inter", data: F("Inter-400.ttf"), weight: 400, style: "normal" },
  { name: "Inter", data: F("Inter-600.ttf"), weight: 600, style: "normal" },
  { name: "Caveat", data: F("Caveat-700.ttf"), weight: 700, style: "normal" },
  { name: "Baloo 2", data: F("Baloo2-800.ttf"), weight: 800, style: "normal" },
] as const;

const out = process.argv[2] || "/tmp/preview-product.png";
const items: ProductCardRow[] = [
  { name: "Tomato", tag: "Natural" },
  { name: "Onion", tag: "Natural" },
  { name: "Sunflower oil", tag: "Processed" },
  { name: "Salt", tag: "Natural" },
  { name: "Sugar", tag: "Processed" },
  { name: "Citric acid", tag: "Processed" },
];
const el = productCard({
  name: "Tradicional Gazpacho",
  brand: "Hacendado",
  items,
  ingredientCount: 9,
});

(async () => {
  const svg = await satori(el as React.ReactNode, { width: 1080, height: 1350, fonts: fonts as never });
  writeFileSync(out, new Resvg(svg).render().asPng());
  console.log("wrote", out);
})();
