import { Fragment } from "react";

// "Also available at" (Order P4): one product, many retailer listings (offers). We show where the
// product was sourced from, then any OTHER retailers that carry it — "From Ocado · also at Tesco,
// Waitrose". Pure presentation over the base `products.retailer` + `offers`; pricing stays out of v1.
//
// Retailers are stored display-ready ("Ocado", "Open Food Facts"). We dedupe case-insensitively (the
// base retailer usually appears among the offers too) and keep the source first. An offer that has a
// URL becomes an outbound link (new tab); the base and URL-less ones are plain text.
export function Availability({
  base,
  offers,
}: {
  base: string | null;
  offers: { retailer: string | null; url: string | null }[];
}) {
  const seen = new Set<string>();
  const list: { name: string; url: string | null }[] = [];
  const push = (name: string | null | undefined, url: string | null) => {
    const clean = name?.trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ name: clean, url });
  };
  push(base, null); // source first
  for (const o of offers) push(o.retailer, o.url);

  if (list.length === 0) return null;
  const [first, ...rest] = list;

  return (
    <p className="text-sm text-muted">
      From {first.name}
      {rest.length > 0 && (
        <>
          {" · also at "}
          {rest.map((r, i) => (
            <Fragment key={`${r.name}-${i}`}>
              {i > 0 && ", "}
              {r.url ? (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-line underline-offset-2 transition hover:text-ink"
                >
                  {r.name}
                </a>
              ) : (
                r.name
              )}
            </Fragment>
          ))}
        </>
      )}
    </p>
  );
}
