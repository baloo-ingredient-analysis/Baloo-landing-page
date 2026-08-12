import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { searchAll } from "@/lib/db/queries/search";
import { embedText, embeddingsEnabled } from "@/lib/embeddings";
import { checkLimit, clientIp, tooMany } from "@/lib/ratelimit";

export const runtime = "nodejs";

// Site search (Order G5 + SS3): public read — products + public lists. HYBRID when embeddings are
// configured (semantic + keyword); pure keyword otherwise. Empty when unconfigured.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const dbi = db();
  if (!dbi || q.trim().length < 2) return NextResponse.json({ products: [], lists: [] });

  // Embed the query for semantic search — only when enabled, and only then does it cost / rate-limit.
  let queryEmbedding: number[] | null = null;
  if (embeddingsEnabled()) {
    const rl = await checkLimit("search", clientIp(req));
    if (!rl.ok) return tooMany(rl.reset);
    queryEmbedding = await embedText(q);
  }

  // Viewer country from Vercel geo (country-level only, no PII) → light geo tiebreak on products (GR4).
  const country = req.headers.get("x-vercel-ip-country");
  const { products, lists } = await searchAll(dbi, q, 10, queryEmbedding, country);
  return NextResponse.json({
    products: products.map((p) => ({ id: p.id, name: p.name, brand: p.brand, slug: p.slug })),
    lists: lists.map((l) => ({
      id: l.id,
      slug: l.slug,
      title: l.title,
      isPublic: l.isPublic,
      itemCount: l.itemCount,
      likeCount: l.likeCount, // L8: likes are public; saveCount stays server-side (private signal)
      ownerHandle: l.ownerHandle,
    })),
  });
}
