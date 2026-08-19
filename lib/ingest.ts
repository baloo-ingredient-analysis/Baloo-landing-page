// Product ingestion (Order G3) — the pipeline's new job: a finished analysis becomes a
// persistent, deduplicated catalog entry. Server-only; a silent no-op when the DB isn't
// configured (optional-infra rule), and it swallows its own errors so it can never break the
// user's analysis stream (it runs inside the analyze route's after()).

import { and, eq, sql } from "drizzle-orm";
import { db, type Db } from "./db";
import {
  ingredientProfileItems,
  ingredientProfiles,
  ingredients as ingredientsTable,
  nutrition as nutritionTable,
  products as productsTable,
} from "./db/schema";
import { upsertProductByCanonicalKey } from "./db/queries/products";
import { upsertOffer } from "./db/queries/offers";
import { canonicalKey, ingredientKey, productSlug } from "./canonical";
import { embedText, productEmbeddingText } from "./embeddings";
import type { Ingredient, Nutrition } from "./schema";

export type IngestInput = {
  product_name: string;
  retailer?: string | null;
  url?: string | null;
  // brand/barcode strengthen the canonical_key. The paste flow has neither (name-only, as before);
  // the mobile API (v1) passes them, so a barcode scan and a URL paste of the same product still
  // converge on ONE row — but only when the identity actually matches.
  brand?: string | null;
  barcode?: string | null;
  ingredients: Ingredient[];
  product_summary?: string | null;
  nutrition?: Nutrition | null;
};

export async function ingestAnalysis(
  input: IngestInput,
): Promise<{ productId: string; slug: string } | null> {
  const dbi = db();
  if (!dbi || !input.product_name || !input.ingredients?.length) return null;

  try {
    const key = canonicalKey({
      name: input.product_name,
      brand: input.brand,
      barcode: input.barcode,
    });
    const slug = productSlug(input.product_name, key);

    // Dedup: converge on one row per canonical_key (descriptive fields refresh on re-scan).
    const product = await upsertProductByCanonicalKey(dbi, {
      canonicalKey: key,
      slug,
      name: input.product_name,
      brand: input.brand ?? null,
      barcode: input.barcode ?? null,
      retailer: input.retailer ?? null,
      source: "user_scan",
    });

    // Record this retailer's listing as an offer (Order P1). A second retailer scanning the same
    // product converges on the same product row with a distinct offer — the dedup, live. Skip when
    // there's no retailer (OFF-sourced products, OFF2): a null/null offer is meaningless.
    if (input.retailer) {
      await upsertOffer(dbi, { productId: product.id, retailer: input.retailer, url: input.url });
    }

    // The canonical analysis is by definition complete once we ingest it.
    await dbi
      .update(productsTable)
      .set({ analysisStatus: "done", analysedAt: sql`now()` })
      .where(eq(productsTable.id, product.id));

    // Fill the product-INDEPENDENT ingredient cache once (what_it_is reused across products).
    await cacheIngredients(dbi, input.ingredients);

    // Write the profile only if there isn't an active one yet — idempotent on re-scan.
    // (Rereformulation → superseding version is a deliberate later refinement.)
    const [existing] = await dbi
      .select({ id: ingredientProfiles.id })
      .from(ingredientProfiles)
      .where(
        and(eq(ingredientProfiles.productId, product.id), eq(ingredientProfiles.isActive, true)),
      )
      .limit(1);

    if (!existing) {
      const [profile] = await dbi
        .insert(ingredientProfiles)
        .values({
          productId: product.id,
          version: 1,
          isActive: true,
          summary: input.product_summary ?? null,
        })
        .returning();

      await dbi.insert(ingredientProfileItems).values(
        input.ingredients.map((ing, i) => ({
          profileId: profile.id,
          rank: i + 1, // label order, absolute
          name: ing.name,
          percent: ing.percentage ?? null,
          role: ing.role ?? null,
          tag: ing.tag ?? null,
          whyItsHere: ing.why_its_here ?? null,
          percentageNote: ing.percentage_note ?? null,
        })),
      );

      if (input.nutrition?.nutrients?.length) {
        await dbi
          .insert(nutritionTable)
          .values({
            productId: product.id,
            servingSize: input.nutrition.serving_size ?? null,
            per: input.nutrition.per ?? "100g",
            nutrients: input.nutrition.nutrients,
          })
          .onConflictDoNothing();
      }
    }

    // Semantic-search embedding (SS1). Best-effort: null without OPENAI_API_KEY and it swallows its
    // own errors, so it never affects the catalog write. Recomputed on re-ingest to stay fresh.
    const embedding = await embedText(
      productEmbeddingText({
        name: input.product_name,
        brand: input.brand,
        summary: input.product_summary,
        ingredientNames: input.ingredients.map((i) => i.name),
      }),
    );
    if (embedding) {
      await dbi.update(productsTable).set({ embedding }).where(eq(productsTable.id, product.id));
    }

    return { productId: product.id, slug };
  } catch (err) {
    console.error("ingestAnalysis error (ignored):", err);
    return null;
  }
}

async function cacheIngredients(dbi: Db, list: Ingredient[]): Promise<void> {
  const seen = new Set<string>();
  const rows: { canonicalName: string; tag: Ingredient["tag"] | null; whatItIs: string | null }[] = [];
  for (const ing of list) {
    const cn = ingredientKey(ing.name);
    if (!cn || seen.has(cn)) continue;
    seen.add(cn);
    rows.push({ canonicalName: cn, tag: ing.tag ?? null, whatItIs: ing.what_it_is ?? null });
  }
  // First write of an ingredient wins; later products contributing the same ingredient are a
  // no-op, so the shared explanation stays stable.
  if (rows.length) await dbi.insert(ingredientsTable).values(rows).onConflictDoNothing();
}
