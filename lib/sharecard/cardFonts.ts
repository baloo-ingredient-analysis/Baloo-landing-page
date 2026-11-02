// Loads the bundled TTFs for the Satori editorial/designed cards (ImageResponse `fonts`). Read once and
// cached per warm instance.
//
// Why not a plain fetch(new URL('./fonts/x', import.meta.url)): that pattern only works where the asset
// resolves to an http(s) URL. In a plain Node script (db:heroes) the URL is file:, which undici's fetch
// can't read ("not implemented… yet…"); in the Next dev/server runtime the bundler can resolve it to a
// relative /_next/static/media/… path that fetch rejects as an invalid URL. So we resolve the bytes off
// disk (file: URL, or the source path under cwd) and only fetch a genuine http(s) URL.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

type CardFont = { name: string; data: ArrayBuffer; weight: 400 | 600 | 700 | 800; style: "normal" };

let cache: CardFont[] | null = null;

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(buf);
  return ab;
}

async function loadFont(file: string): Promise<ArrayBuffer> {
  try {
    const u = new URL(`./fonts/${file}`, import.meta.url);
    if (u.protocol === "file:") return toArrayBuffer(await readFile(fileURLToPath(u)));
    if (u.protocol === "http:" || u.protocol === "https:") return await fetch(u).then((r) => r.arrayBuffer());
  } catch {
    // fall through to the on-disk source path
  }
  return toArrayBuffer(await readFile(path.join(process.cwd(), "lib", "sharecard", "fonts", file)));
}

export async function loadCardFonts(): Promise<CardFont[]> {
  if (cache) return cache;
  const [pd700, pd600, inter400, inter600, caveat700, baloo800] = await Promise.all([
    loadFont("PlayfairDisplay-700.ttf"),
    loadFont("PlayfairDisplay-600.ttf"),
    loadFont("Inter-400.ttf"),
    loadFont("Inter-600.ttf"),
    loadFont("Caveat-700.ttf"),
    loadFont("Baloo2-800.ttf"),
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
