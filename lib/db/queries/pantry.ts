// Pantry queries (Order PP1) — a user's private collection of SAVED PRODUCTS (product_saves).
// Distinct from saves.ts (saved LISTS). Callers own the db() null-guard and the auth check; the
// Pantry is private, so every read is scoped to one userId.

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../index";
import { productSaves, products, type Product } from "../schema";

export async function saveProduct(dbi: Db, userId: string, productId: string): Promise<void> {
  await dbi.insert(productSaves).values({ userId, productId }).onConflictDoNothing();
}

export async function unsaveProduct(dbi: Db, userId: string, productId: string): Promise<void> {
  await dbi
    .delete(productSaves)
    .where(and(eq(productSaves.userId, userId), eq(productSaves.productId, productId)));
}

export async function isProductSaved(dbi: Db, userId: string, productId: string): Promise<boolean> {
  const [row] = await dbi
    .select({ one: sql<number>`1` })
    .from(productSaves)
    .where(and(eq(productSaves.userId, userId), eq(productSaves.productId, productId)))
    .limit(1);
  return !!row;
}

// Bulk "which of these products has the viewer saved" — SSR hydration for a grid of product cards.
export async function getSavedProductIds(
  dbi: Db,
  userId: string,
  productIds: string[],
): Promise<Set<string>> {
  if (productIds.length === 0) return new Set();
  const rows = await dbi
    .select({ productId: productSaves.productId })
    .from(productSaves)
    .where(and(eq(productSaves.userId, userId), inArray(productSaves.productId, productIds)));
  return new Set(rows.map((r) => r.productId));
}

// The Pantry tab: a user's saved products, newest-saved first. Private — always one userId.
export async function getPantry(dbi: Db, userId: string): Promise<Product[]> {
  const rows = await dbi
    .select({ product: products })
    .from(productSaves)
    .innerJoin(products, eq(products.id, productSaves.productId))
    .where(eq(productSaves.userId, userId))
    .orderBy(desc(productSaves.createdAt));
  return rows.map((r) => r.product);
}

export async function countPantry(dbi: Db, userId: string): Promise<number> {
  const [{ n }] = await dbi
    .select({ n: sql<number>`count(*)::int` })
    .from(productSaves)
    .where(eq(productSaves.userId, userId));
  return n ?? 0;
}
