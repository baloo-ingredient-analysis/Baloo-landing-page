import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { searchAll } from "@/lib/db/queries/search";

// Site search (Order G5): public read — products + public lists. Empty when unconfigured.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const dbi = db();
  if (!dbi || q.trim().length < 2) return NextResponse.json({ products: [], lists: [] });

  const { products, lists } = await searchAll(dbi, q);
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
