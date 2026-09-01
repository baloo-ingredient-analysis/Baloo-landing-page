import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getListBySlug, getPendingItems } from "@/lib/db/queries/lists";
import { getSessionUser } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { ListEditor } from "@/components/lists/ListEditor";

// Owner-only list editor (Order G4). Non-owners (and signed-out) get a 404 — no existence leak.
type Params = { params: Promise<{ slug: string }> };

export default async function EditListPage({ params }: Params) {
  const { slug } = await params;
  const dbi = db();
  const list = dbi ? await getListBySlug(dbi, slug) : null;
  if (!list) notFound();

  const user = await getSessionUser();
  if (!user || user.id !== list.ownerId) notFound();

  // Background OFF analyses in flight (or failed) for this list — the editor resumes/retries them.
  const pending = dbi ? await getPendingItems(dbi, list.id) : [];

  const initial = {
    id: list.id,
    slug: list.slug,
    title: list.title,
    description: list.description ?? "",
    isPublic: list.isPublic,
    items: list.items.map((i) => ({
      productId: i.productId,
      name: i.product.name,
      brand: i.product.brand,
      slug: i.product.slug,
      note: i.note ?? "",
    })),
    pending: pending.map((p) => ({
      barcode: p.barcode,
      name: p.name,
      brand: p.brand,
      status: p.status === "failed" ? ("failed" as const) : ("analysing" as const),
    })),
  };

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* List controls (Done/Edit) live with the list itself, not in the top bar — see ListEditor. */}
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-tool flex-1 flex-col px-5 pt-8">
        <ListEditor initial={initial} />
      </main>
    </div>
  );
}
