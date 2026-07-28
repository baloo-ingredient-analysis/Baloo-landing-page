import Link from "next/link";
import { ListCover } from "./ListCover";
import type { ListWithCounts } from "@/lib/db/queries/lists";

// Region availability (Order L7) — only Discover passes it. Neutral ink/muted tints; green/amber
// stay reserved for the Natural/Processed classification, never for availability.
type Availability = { label: string; tone: "full" | "most" | "some" | "none" } | null;
const DOT: Record<NonNullable<Availability>["tone"], string> = {
  full: "bg-ink",
  most: "bg-ink/55",
  some: "bg-muted",
  none: "bg-line",
};

// The list card (Order G4) — the unit shown in profiles, feeds and discovery grids.
export function ListCard({
  list,
  handle,
  availability,
}: {
  list: ListWithCounts;
  handle?: string | null;
  availability?: Availability;
}) {
  return (
    <Link
      href={`/list/${list.slug}`}
      className="group block overflow-hidden rounded-2xl border border-line bg-paper shadow-card transition duration-200 hover:shadow-card-hover"
    >
      <ListCover title={list.title} seed={list.slug} className="h-28" monogramClassName="text-5xl" />
      <div className="p-4">
        <h3 className="font-display text-lg leading-tight text-ink">{list.title}</h3>
        {handle && <p className="mt-1 text-sm text-muted">by @{handle}</p>}
        {/* Public counts only (L8): likes are shown, saves are a private/internal signal. */}
        <p className="mt-2 flex items-center gap-1 text-xs tabular-nums text-muted">
          <span>
            {list.itemCount} {list.itemCount === 1 ? "product" : "products"}
          </span>
          {list.likeCount > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-0.5">
                <svg viewBox="0 0 14 13" fill="currentColor" aria-hidden className="h-3 w-3 text-like">
                  <path d="M7 12.1 1.6 6.9a3.2 3.2 0 0 1 4.5-4.5l.9.9.9-.9a3.2 3.2 0 1 1 4.5 4.5L7 12.1z" />
                </svg>
                {list.likeCount}
              </span>
            </>
          )}
          {!list.isPublic && <span>· private</span>}
        </p>
        {availability && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
            <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[availability.tone]}`} />
            {availability.label}
          </p>
        )}
      </div>
    </Link>
  );
}
