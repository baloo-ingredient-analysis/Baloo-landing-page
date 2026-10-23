// Local preview of the Satori editorial card (dev only) — renders lib/sharecard/editorialCard to a PNG
// with the bundled fonts, so the real Satori output can be eyeballed before deploying.
//   npx tsx scripts/preview-card.tsx <heroImage.png> <out.png>
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "fs";
import { editorialCard } from "../lib/sharecard/editorialCard";

const F = (p: string) => readFileSync(new URL(`../lib/sharecard/fonts/${p}`, import.meta.url));
const fonts = [
  { name: "Playfair Display", data: F("PlayfairDisplay-700.ttf"), weight: 700, style: "normal" },
  { name: "Playfair Display", data: F("PlayfairDisplay-600.ttf"), weight: 600, style: "normal" },
  { name: "Inter", data: F("Inter-400.ttf"), weight: 400, style: "normal" },
  { name: "Inter", data: F("Inter-600.ttf"), weight: 600, style: "normal" },
  { name: "Caveat", data: F("Caveat-700.ttf"), weight: 700, style: "normal" },
  { name: "Baloo 2", data: F("Baloo2-800.ttf"), weight: 800, style: "normal" },
] as const;

const heroPath = process.argv[2];
const outPath = process.argv[3] || "/tmp/preview-v2.png";
const heroUrl = heroPath ? `data:image/png;base64,${readFileSync(heroPath).toString("base64")}` : null;

const el = editorialCard({
  title: "UK cupboard basics",
  subtitle: "Pantry · Drinks · Spreads",
  heroUrl,
  ownerName: "Tom Hedley",
  handle: "tomreadslabels",
  productCount: 5,
});

(async () => {
  const svg = await satori(el as React.ReactNode, { width: 1080, height: 1350, fonts: fonts as never });
  const png = new Resvg(svg).render().asPng();
  writeFileSync(outPath, png);
  console.log("wrote", outPath, png.length, "bytes");
})();
