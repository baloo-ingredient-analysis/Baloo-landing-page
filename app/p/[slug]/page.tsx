import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getProductForPage } from "@/lib/db/queries/products";
import { ResultsView } from "@/components/ResultsView";
import { SiteHeader } from "@/components/SiteHeader";
import { AddToList } from "@/components/lists/AddToList";
import { PantryButton } from "@/components/engagement/PantryButton";
import { CommentThread } from "@/components/engagement/CommentThread";
import { getSessionUser } from "@/lib/auth";
import { getThread } from "@/lib/db/queries/comments";
import { isProductSaved } from "@/lib/db/queries/pantry";
import { storedIngredients } from "@/lib/analysis/stored";
import type { Ingredient, Nutrition } from "@/lib/schema";

// The canonical product page (Order G3): a permanent, shareable, SSR'd page per product, read
// from Postgres and rendered through the SAME F2 ingredient list + B4 nutrition tab the live tool
// streams. This is what lists (G4) link to and discussions (G8) hang off.

type Params = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const dbi = db();
  return dbi ? getProductForPage(dbi, slug) : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Baloo" };
  const title = `${data.product.name} — Baloo`;
  const description = data.summary ?? `What's in ${data.product.name}: every ingredient explained.`;
  return { title, description, openGraph: { title, description } };
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();

  // Discussion + engagement state (Order G8; PP1 adds Save-to-Pantry). A product's actions are now
  // "Save" (→ your private Pantry) and "Add to my list"; there's still no product Like (lists only).
  // SSR-hydrated.
  const dbi = db()!; // load() already proved it exists
  const viewer = await getSessionUser();
  const [thread, viewerSavedProduct] = await Promise.all([
    getThread(dbi, data.product.id, { sort: "top", viewerId: viewer?.id ?? null }),
    viewer ? isProductSaved(dbi, viewer.id, data.product.id) : Promise.resolve(false),
  ]);

  // One shared mapping (Order P2) so this page and the extract short-circuit can't drift apart.
  const ingredients: Partial<Ingredient>[] = storedIngredients(data);

  const nutrition: Nutrition | undefined = data.nutrition
    ? {
        serving_size: data.nutrition.servingSize,
        per: data.nutrition.per,
        nutrients: data.nutrition.nutrients,
      }
    : undefined;

  return (
    <div className="relative flex min-h-screen flex-col">
      <SiteHeader
        action={
          <div className="flex items-center gap-2">
            <PantryButton productId={data.product.id} initialSaved={viewerSavedProduct} />
            <AddToList productId={data.product.id} />
          </div>
        }
      />
      <main className="mx-auto flex w-full max-w-tool flex-1 flex-col px-5 pt-8">
        {data.items.length > 0 ? (
          // loading={false} → ResultsView renders the finished (non-streaming) product view.
          <ResultsView
            productName={data.product.name}
            retailer={data.product.retailer ?? ""}
            sourceUrl=""
            count={data.items.length}
            ingredients={ingredients}
            nutrition={nutrition}
            cacheKey={data.product.id}
            productSummary={data.summary ?? undefined}
            loading={false}
          />
        ) : (
          // Catalog product not yet explained (e.g. seeded from Open Food Facts before its AI
          // pass) — a calm placeholder, never a spinner.
          <section className="mt-12 animate-fade-in border-t border-line pt-6">
            <h1 className="font-display text-2xl leading-tight text-ink sm:text-3xl">
              {data.product.name}
            </h1>
            {data.product.retailer && (
              <p className="mt-1.5 text-sm text-muted">{data.product.retailer}</p>
            )}
            <p className="mt-4 text-sm text-muted">
              We haven&apos;t broken this one down yet — its ingredient explanation is on the way.
            </p>
          </section>
        )}

        {/* Product discussion (Order G8), SSR-hydrated. */}
        <CommentThread productId={data.product.id} initial={thread} />
      </main>
    </div>
  );
}
