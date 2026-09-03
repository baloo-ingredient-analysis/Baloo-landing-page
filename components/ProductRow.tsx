import Link from "next/link";

// Shared product row (Order L1f) — one idiom for "a product in a list", used by Discover's
// "Recently analysed" and the search results in SearchBox (and reusable on profiles later). Pure
// presentational (no hooks), so it works in server and client components alike. Brand-initial
// thumbnail + Playfair name + a neutral brand·retailer meta line + the app's SVG chevron.
export function ProductRow({
  slug,
  name,
  brand,
  retailer,
  meta,
  onClick,
  onQuickView,
}: {
  slug?: string; // omit for a not-yet-analysed product (use onClick instead)
  name: string;
  brand?: string | null;
  retailer?: string | null;
  meta?: string; // overrides the default brand·retailer join when a caller wants different text
  onClick?: () => void; // when set, the row is a button (analyse-on-tap) instead of a link
  onQuickView?: (slug: string) => void; // catalog rows: plain left-click opens the quick-view drawer
}) {
  const metaLine = meta ?? [brand, retailer].filter(Boolean).join(" · ");
  const cls = "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-canvas sm:px-5";
  const inner = (
    <>
      <span
        aria-hidden
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg bg-canvas font-display text-lg text-ink/30"
      >
        {(brand ?? name)[0]?.toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[17px] leading-tight text-ink">{name}</span>
        {metaLine && <span className="block truncate text-xs text-muted">{metaLine}</span>}
      </span>
      <RowChevron />
    </>
  );
  return (
    <li>
      {onClick ? (
        <button type="button" onClick={onClick} className={cls}>
          {inner}
        </button>
      ) : (
        <Link
          href={`/p/${slug}`}
          onClick={
            onQuickView && slug
              ? (e) => {
                  // Let modified / non-primary clicks navigate (open in new tab); plain click peeks.
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  e.preventDefault();
                  onQuickView(slug);
                }
              : undefined
          }
          className={cls}
        >
          {inner}
        </Link>
      )}
    </li>
  );
}

// The single source for the row affordance chevron — reused across product + list rows so the whole
// app points the same way.
export function RowChevron() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-4 w-4 shrink-0 text-muted"
    >
      <path d="M6 3.5L10.5 8 6 12.5" />
    </svg>
  );
}
