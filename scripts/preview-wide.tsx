// Local preview of the wide (1.91:1) unfurl card → PNG. Dev only.
//   npx tsx scripts/preview-wide.tsx <out.png> [heroImage]
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "fs";
import { wideCard } from "../lib/sharecard/wideCard";

const F = (p: string) => readFileSync(new URL(`../lib/sharecard/fonts/${p}`, import.meta.url));
const fonts = [
  { name: "Playfair Display", data: F("PlayfairDisplay-700.ttf"), weight: 700, style: "normal" },
  { name: "Playfair Display", data: F("PlayfairDisplay-600.ttf"), weight: 600, style: "normal" },
  { name: "Inter", data: F("Inter-400.ttf"), weight: 400, style: "normal" },
  { name: "Inter", data: F("Inter-600.ttf"), weight: 600, style: "normal" },
  { name: "Caveat", data: F("Caveat-700.ttf"), weight: 700, style: "normal" },
  { name: "Baloo 2", data: F("Baloo2-800.ttf"), weight: 800, style: "normal" },
] as const;

const out = process.argv[2] || "/tmp/preview-wide.png";
const heroPath = process.argv[3];
const heroMime = heroPath && /\.jpe?g$/i.test(heroPath) ? "image/jpeg" : "image/png";
const heroUrl = heroPath ? `data:${heroMime};base64,${readFileSync(heroPath).toString("base64")}` : null;

const el = wideCard({
  title: process.env.CARD_TITLE || "My 10 best supermarket tomato sauces",
  subtitle: process.env.CARD_SUBTITLE || "Real ingredients · A brighter plate",
  heroUrl,
  items: (process.env.CARD_ITEMS ||
    "Mutti Polpa|Passata di Pomodoro Bio|Barilla Basilico|Cirio Datterini|De Cecco Arrabbiata").split("|"),
  ownerName: process.env.CARD_OWNER || "Clara Rossi",
  handle: process.env.CARD_HANDLE || "clarascucina",
  productCount: Number(process.env.CARD_COUNT || 10),
});

(async () => {
  const svg = await satori(el as React.ReactNode, { width: 1200, height: 630, fonts: fonts as never });
  writeFileSync(out, new Resvg(svg).render().asPng());
  console.log("wrote", out);
})();
