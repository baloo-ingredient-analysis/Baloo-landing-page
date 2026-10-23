// Loads the bundled TTFs for the Satori editorial card (ImageResponse `fonts`). The `new URL(...,
// import.meta.url)` pattern is how next/og bundles font assets so they ship with the serverless
// function. Fetched once and cached per warm instance.

type CardFont = { name: string; data: ArrayBuffer; weight: 400 | 600 | 700 | 800; style: "normal" };

let cache: CardFont[] | null = null;

export async function loadCardFonts(): Promise<CardFont[]> {
  if (cache) return cache;
  const load = (p: string) => fetch(new URL(`./fonts/${p}`, import.meta.url)).then((r) => r.arrayBuffer());
  const [pd700, pd600, inter400, inter600, caveat700, baloo800] = await Promise.all([
    load("PlayfairDisplay-700.ttf"),
    load("PlayfairDisplay-600.ttf"),
    load("Inter-400.ttf"),
    load("Inter-600.ttf"),
    load("Caveat-700.ttf"),
    load("Baloo2-800.ttf"),
  ]);
  cache = [
    { name: "Playfair Display", data: pd700, weight: 700, style: "normal" },
    { name: "Playfair Display", data: pd600, weight: 600, style: "normal" },
    { name: "Inter", data: inter400, weight: 400, style: "normal" },
    { name: "Inter", data: inter600, weight: 600, style: "normal" },
    { name: "Caveat", data: caveat700, weight: 700, style: "normal" },
    { name: "Baloo 2", data: baloo800, weight: 800, style: "normal" },
  ];
  return cache;
}
